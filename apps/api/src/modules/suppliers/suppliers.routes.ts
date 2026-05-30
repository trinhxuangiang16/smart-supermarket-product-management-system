import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";
const router = Router();
const schema = z.object({
  name: z.string().min(2),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  notes: z.string().optional(),
});
router.get("/", requireAuth, async (_req, res) => res.json(ok(await prisma.supplier.findMany({
  orderBy: { name: "asc" },
  include: { _count: { select: { products: true } } },
}))));
router.get("/:id", requireAuth, async (req, res) => {
  const item = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { products: true } } },
  });
  if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Supplier not found" } });
  return res.json(ok(item));
});
router.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const p = schema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: p.error.flatten() } });
  const created = await prisma.supplier.create({
    data: {
      ...p.data,
      contactEmail: p.data.contactEmail || null,
      contactPerson: p.data.contactPerson || null,
      notes: p.data.notes || null,
    },
  });
  await createAuditLog({ action: "SUPPLIER_CREATE", entity: "Supplier", entityId: created.id, userId: req.user!.id, after: created });
  return res.status(201).json(ok(created, "Supplier created"));
});
router.put("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const p = schema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: p.error.flatten() } });
  const before = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Supplier not found" } });
  const updated = await prisma.supplier.update({
    where: { id: req.params.id },
    data: {
      ...p.data,
      contactEmail: p.data.contactEmail || null,
      contactPerson: p.data.contactPerson || null,
      notes: p.data.notes || null,
    },
  });
  await createAuditLog({ action: "SUPPLIER_UPDATE", entity: "Supplier", entityId: updated.id, userId: req.user!.id, before, after: updated });
  return res.json(ok(updated, "Supplier updated"));
});
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const before = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { products: true } } },
  });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Supplier not found" } });
  if (before._count.products > 0) {
    return res.status(409).json({ error: { code: "CONFLICT", message: "Cannot delete supplier that is linked to existing products" } });
  }
  await prisma.supplier.delete({ where: { id: req.params.id } });
  await createAuditLog({ action: "SUPPLIER_DELETE", entity: "Supplier", entityId: req.params.id, userId: req.user!.id, before });
  return res.json(ok({}, "Supplier deleted"));
});
export default router;
