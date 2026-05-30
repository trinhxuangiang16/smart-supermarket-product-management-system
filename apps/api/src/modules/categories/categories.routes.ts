import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";
const router = Router();
const schema = z.object({ name: z.string().min(2), description: z.string().optional() });
router.get("/", requireAuth, async (_req, res) =>
  res.json(
    ok(
      await prisma.category.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
      }),
    ),
  ));
router.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const p = schema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: p.error.flatten() } });
  const created = await prisma.category.create({ data: p.data });
  await createAuditLog({ action: "CATEGORY_CREATE", entity: "Category", entityId: created.id, userId: req.user!.id, after: created });
  return res.status(201).json(ok(created, "Category created"));
});
router.put("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const p = schema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: p.error.flatten() } });
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  const updated = await prisma.category.update({ where: { id: req.params.id }, data: p.data });
  await createAuditLog({ action: "CATEGORY_UPDATE", entity: "Category", entityId: updated.id, userId: req.user!.id, before, after: updated });
  return res.json(ok(updated, "Category updated"));
});
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const productsCount = await prisma.product.count({ where: { categoryId: req.params.id } });
  if (productsCount > 0) {
    return res.status(400).json({
      error: {
        code: "CATEGORY_IN_USE",
        message: "Cannot delete category with existing products",
      },
    });
  }
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  await prisma.category.delete({ where: { id: req.params.id } });
  await createAuditLog({ action: "CATEGORY_DELETE", entity: "Category", entityId: req.params.id, userId: req.user!.id, before });
  return res.json(ok({}, "Category deleted"));
});
export default router;
