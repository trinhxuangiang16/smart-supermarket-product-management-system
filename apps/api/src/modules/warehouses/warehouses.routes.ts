import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";

const router = Router();

const warehouseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(40),
  address: z.string().trim().max(240).optional(),
  isActive: z.boolean().optional(),
});

router.get("/", requireAuth, async (_req, res) => {
  const items = await prisma.warehouse.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return res.json(ok(items));
});

router.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = warehouseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  const created = await prisma.warehouse.create({ data: { ...parsed.data, address: parsed.data.address || null } });
  await createAuditLog({ action: "WAREHOUSE_CREATE", entity: "Warehouse", entityId: created.id, userId: req.user!.id, after: created });
  return res.status(201).json(ok(created, "Warehouse created"));
});

router.put("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = warehouseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  const before = await prisma.warehouse.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Warehouse not found" } });
  const updated = await prisma.warehouse.update({
    where: { id: req.params.id },
    data: { ...parsed.data, address: parsed.data.address || null },
  });
  await createAuditLog({ action: "WAREHOUSE_UPDATE", entity: "Warehouse", entityId: updated.id, userId: req.user!.id, before, after: updated });
  return res.json(ok(updated, "Warehouse updated"));
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const before = await prisma.warehouse.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Warehouse not found" } });
  const txCount = await prisma.inventoryTransaction.count({ where: { warehouseId: req.params.id } });
  if (txCount > 0) {
    return res.status(400).json({ error: { code: "WAREHOUSE_IN_USE", message: "Cannot delete warehouse that has transactions" } });
  }
  await prisma.warehouse.delete({ where: { id: req.params.id } });
  await createAuditLog({ action: "WAREHOUSE_DELETE", entity: "Warehouse", entityId: req.params.id, userId: req.user!.id, before });
  return res.json(ok({}, "Warehouse deleted"));
});

export default router;

