import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";

const router = Router();

const assetSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  type: z.string().trim().min(2).max(60),
  status: z.enum(["ACTIVE", "IN_REPAIR", "RETIRED", "LOST"]).optional(),
  purchaseDate: z.coerce.date(),
  cost: z.coerce.number().min(0),
  depreciationMonths: z.coerce.number().int().min(0).max(600).default(0),
  warehouseId: z.string().optional().or(z.literal("")),
  assignedUserId: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(["ACTIVE", "IN_REPAIR", "RETIRED", "LOST"]).optional(),
  warehouseId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "code", "purchaseDate", "cost", "createdAt"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

// Linear depreciation: remaining value after full elapsed months, floored at 0
const monthsBetween = (from: Date, to: Date) => {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return to.getDate() >= from.getDate() ? months : months - 1;
};

const withDepreciation = (asset: { cost: unknown; depreciationMonths: number; purchaseDate: Date }) => {
  const cost = Number(asset.cost);
  const elapsed = Math.max(0, monthsBetween(new Date(asset.purchaseDate), new Date()));
  if (!asset.depreciationMonths) {
    return { ...asset, monthlyDepreciation: 0, monthsElapsed: elapsed, currentValue: cost };
  }
  const monthly = cost / asset.depreciationMonths;
  const currentValue = Math.max(0, cost - monthly * elapsed);
  return {
    ...asset,
    monthlyDepreciation: Number(monthly.toFixed(2)),
    monthsElapsed: elapsed,
    currentValue: Number(currentValue.toFixed(2)),
  };
};

const normalize = (data: z.infer<typeof assetSchema>) => ({
  ...data,
  status: data.status ?? "ACTIVE",
  warehouseId: data.warehouseId || null,
  assignedUserId: data.assignedUserId || null,
  notes: data.notes || null,
});

router.get("/", requireAuth, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } });
  const q = parsed.data;
  const where: Record<string, unknown> = { isDeleted: false };
  if (q.search) where.OR = [{ name: { contains: q.search } }, { code: { contains: q.search } }, { type: { contains: q.search } }];
  if (q.type) where.type = q.type;
  if (q.status) where.status = q.status;
  if (q.warehouseId) where.warehouseId = q.warehouseId;
  const [total, items] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      include: { warehouse: { select: { id: true, name: true, code: true } }, assignedUser: { select: { id: true, name: true, email: true } } },
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return res.json(ok({
    items: items.map(withDepreciation),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  }));
});

router.get("/:id", requireAuth, async (req, res) => {
  const item = await prisma.asset.findFirst({
    where: { id: req.params.id, isDeleted: false },
    include: { warehouse: true, assignedUser: { select: { id: true, name: true, email: true } } },
  });
  if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Asset not found" } });
  return res.json(ok(withDepreciation(item)));
});

router.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = assetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  const exists = await prisma.asset.findUnique({ where: { code: parsed.data.code } });
  if (exists) return res.status(409).json({ error: { code: "CONFLICT", message: "Asset code already exists" } });
  const created = await prisma.asset.create({ data: normalize(parsed.data) });
  await createAuditLog({ action: "ASSET_CREATE", entity: "Asset", entityId: created.id, userId: req.user!.id, after: created });
  return res.status(201).json(ok(withDepreciation(created), "Asset created"));
});

router.put("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = assetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  const before = await prisma.asset.findFirst({ where: { id: req.params.id, isDeleted: false } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Asset not found" } });
  const duplicate = await prisma.asset.findFirst({ where: { code: parsed.data.code, id: { not: req.params.id } } });
  if (duplicate) return res.status(409).json({ error: { code: "CONFLICT", message: "Asset code already exists" } });
  const updated = await prisma.asset.update({ where: { id: req.params.id }, data: normalize(parsed.data) });
  await createAuditLog({ action: "ASSET_UPDATE", entity: "Asset", entityId: updated.id, userId: req.user!.id, before, after: updated });
  return res.json(ok(withDepreciation(updated), "Asset updated"));
});

router.delete("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const before = await prisma.asset.findFirst({ where: { id: req.params.id, isDeleted: false } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Asset not found" } });
  await prisma.asset.update({ where: { id: req.params.id }, data: { isDeleted: true, deletedAt: new Date() } });
  await createAuditLog({ action: "ASSET_DELETE", entity: "Asset", entityId: req.params.id, userId: req.user!.id, before });
  return res.json(ok({ id: req.params.id }, "Asset deleted"));
});

export default router;
