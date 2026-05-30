import { Router } from "express";
import { z } from "zod";
import { comparePassword, hashPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";
import {
  createSavedFilter,
  deleteSavedFilter,
  getPreferences,
  getSystemSettings,
  listSavedFilters,
  updateSystemSettings,
  updatePreferences,
} from "./settings.store.js";

const router = Router();

const preferencesPatchSchema = z.object({
  notifications: z.object({
    approvalInApp: z.boolean().optional(),
    stockAlertEmail: z.boolean().optional(),
    expiryAlertEmail: z.boolean().optional(),
    dailySummaryEmail: z.boolean().optional(),
  }).optional(),
  ui: z.object({
    compactTables: z.boolean().optional(),
    defaultPageSize: z.number().int().min(5).max(100).optional(),
    currency: z.literal("USD").optional(),
    dateFormat: z.literal("MM/dd/yyyy").optional(),
  }).optional(),
  roadmap: z.object({
    aiPromoSuggestion: z.boolean().optional(),
    posScannerIntegration: z.boolean().optional(),
    advancedBiReports: z.boolean().optional(),
  }).optional(),
});

const systemSettingsPatchSchema = z.object({
  profile: z.object({
    storeName: z.string().trim().min(2).max(120).optional(),
    branchName: z.string().trim().min(2).max(120).optional(),
    address: z.string().trim().max(240).optional(),
    contactPhone: z.string().trim().max(40).optional(),
    contactEmail: z.string().trim().email().or(z.literal("")).optional(),
    taxCode: z.string().trim().max(40).optional(),
  }).optional(),
  operations: z.object({
    lowStockThreshold: z.number().int().min(0).max(100000).optional(),
    defaultReorderLevel: z.number().int().min(0).max(100000).optional(),
    approvalBellRefreshSeconds: z.number().int().min(2).max(120).optional(),
    dashboardActivityRefreshSeconds: z.number().int().min(2).max(120).optional(),
    recentActivityLimit: z.number().int().min(3).max(30).optional(),
  }).optional(),
  reports: z.object({
    preparedBy: z.string().trim().min(2).max(80).optional(),
    footerNote: z.string().trim().min(3).max(240).optional(),
    includeContactInExport: z.boolean().optional(),
  }).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const savedFilterCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  scope: z.enum(["products", "inventory", "expiry"]),
  query: z.record(z.string()).default({}),
});

const savedFilterQuerySchema = z.object({
  scope: z.enum(["products", "inventory", "expiry"]).optional(),
});

router.get("/system", requireAuth, async (_req: AuthRequest, res) => {
  const settings = await getSystemSettings();
  return res.json(ok(settings));
});

router.put("/system", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = systemSettingsPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  const hasAnyChange = Object.values(parsed.data).some((v) => v && Object.keys(v).length > 0);
  if (!hasAnyChange) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No settings payload provided" } });
  }
  const before = await getSystemSettings();
  const updated = await updateSystemSettings(parsed.data);
  await createAuditLog({
    action: "SYSTEM_SETTINGS_UPDATE",
    entity: "SystemSettings",
    entityId: "global",
    userId: req.user!.id,
    before,
    after: updated,
  });
  return res.json(ok(updated, "System settings updated"));
});

router.get("/preferences", requireAuth, async (req: AuthRequest, res) => {
  const preferences = await getPreferences(req.user!.id);
  return res.json(ok(preferences));
});

router.put("/preferences", requireAuth, async (req: AuthRequest, res) => {
  const parsed = preferencesPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  const hasAnyChange = Object.values(parsed.data).some((v) => v && Object.keys(v).length > 0);
  if (!hasAnyChange) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No settings payload provided" } });
  }

  const before = await getPreferences(req.user!.id);
  const updated = await updatePreferences(req.user!.id, parsed.data);
  await createAuditLog({
    action: "SETTINGS_UPDATE",
    entity: "UserSettings",
    entityId: req.user!.id,
    userId: req.user!.id,
    before,
    after: updated,
  });
  return res.json(ok(updated, "Settings updated"));
});

router.patch("/change-password", requireAuth, async (req: AuthRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "New password must be different from current password" } });
  }
  const currentUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!currentUser) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
  }
  const matched = await comparePassword(parsed.data.currentPassword, currentUser.passwordHash);
  if (!matched) {
    return res.status(400).json({ error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect" } });
  }
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  await createAuditLog({
    action: "USER_PASSWORD_CHANGE_SELF",
    entity: "User",
    entityId: req.user!.id,
    userId: req.user!.id,
  });
  return res.json(ok({ id: req.user!.id }, "Password updated"));
});

router.get("/saved-filters", requireAuth, async (req: AuthRequest, res) => {
  const parsed = savedFilterQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } });
  }
  const items = await listSavedFilters(req.user!.id, parsed.data.scope);
  return res.json(ok(items));
});

router.post("/saved-filters", requireAuth, async (req: AuthRequest, res) => {
  const parsed = savedFilterCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  const saved = await createSavedFilter(req.user!.id, parsed.data);
  await createAuditLog({
    action: "SAVED_FILTER_CREATE",
    entity: "SavedFilter",
    entityId: saved.id,
    userId: req.user!.id,
    after: saved,
  });
  return res.status(201).json(ok(saved, "Saved filter created"));
});

router.delete("/saved-filters/:id", requireAuth, async (req: AuthRequest, res) => {
  const removed = await deleteSavedFilter(req.user!.id, req.params.id);
  if (!removed) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Saved filter not found" } });
  await createAuditLog({
    action: "SAVED_FILTER_DELETE",
    entity: "SavedFilter",
    entityId: req.params.id,
    userId: req.user!.id,
  });
  return res.json(ok({ id: req.params.id }, "Saved filter deleted"));
});

router.get("/roadmap", requireAuth, async (_req, res) => {
  return res.json(ok([
    { feature: "Advanced BI reports", status: "STUB", notes: "TODO: scheduled aggregations and configurable report builder." },
    { feature: "Excel/PDF export", status: "STUB", notes: "TODO: export workers and background jobs." },
    { feature: "POS scanner integration", status: "STUB", notes: "TODO: barcode scanner bridge and POS webhooks." },
    { feature: "AI promotion suggestions", status: "STUB", notes: "TODO: model-driven scoring and approval workflow." },
    { feature: "Advanced virtual scrolling", status: "STUB", notes: "TODO: large-table optimization for 50k+ rows." },
  ]));
});

router.get("/permission-matrix", requireAuth, requireRole("ADMIN", "MANAGER"), async (_req, res) => {
  return res.json(ok([
    { role: "ADMIN", permissions: ["users:full", "products:full", "inventory:full", "reports:full", "settings:full", "automation:full"] },
    { role: "MANAGER", permissions: ["users:none", "products:full", "inventory:full", "reports:full", "settings:system", "automation:full"] },
    { role: "WAREHOUSE_STAFF", permissions: ["products:create+request_edit_delete", "inventory:in_adjust_destroy", "reports:read", "settings:personal"] },
    { role: "CASHIER", permissions: ["products:read", "inventory:out", "reports:read", "settings:personal"] },
    { role: "SALE_DEPARTMENT", permissions: ["reports:read", "audit:read", "settings:personal"] },
    { role: "FINANCE_DEPARTMENT", permissions: ["reports:read", "audit:read", "settings:personal"] },
  ]));
});

export default router;
