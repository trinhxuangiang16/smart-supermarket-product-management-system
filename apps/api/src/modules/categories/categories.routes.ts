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
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
});
router.get("/", requireAuth, async (_req, res) =>
  res.json(
    ok(
      await prisma.category.findMany({
        orderBy: { name: "asc" },
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { products: true, children: true } },
        },
      }),
    ),
  ));
router.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const p = schema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: p.error.flatten() } });
  if (p.data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: p.data.parentId } });
    if (!parent) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Parent category not found" } });
  }
  const created = await prisma.category.create({ data: p.data });
  await createAuditLog({ action: "CATEGORY_CREATE", entity: "Category", entityId: created.id, userId: req.user!.id, after: created });
  return res.status(201).json(ok(created, "Category created"));
});
router.put("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const p = schema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: p.error.flatten() } });
  if (p.data.parentId === req.params.id) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Category cannot be parent of itself" } });
  if (p.data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: p.data.parentId } });
    if (!parent) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Parent category not found" } });
  }
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  const updated = await prisma.category.update({ where: { id: req.params.id }, data: p.data });
  await createAuditLog({ action: "CATEGORY_UPDATE", entity: "Category", entityId: updated.id, userId: req.user!.id, before, after: updated });
  return res.json(ok(updated, "Category updated"));
});
router.patch("/:id/visibility", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Category not found" } });
  const updated = await prisma.category.update({ where: { id: req.params.id }, data: { isActive: parsed.data.isActive } });
  await createAuditLog({
    action: parsed.data.isActive ? "CATEGORY_SHOW" : "CATEGORY_HIDE",
    entity: "Category",
    entityId: updated.id,
    userId: req.user!.id,
    before,
    after: updated,
  });
  return res.json(ok(updated, parsed.data.isActive ? "Category is now visible" : "Category hidden"));
});
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const productsCount = await prisma.product.count({ where: { categoryId: req.params.id } });
  const childrenCount = await prisma.category.count({ where: { parentId: req.params.id } });
  if (productsCount > 0) {
    return res.status(400).json({
      error: {
        code: "CATEGORY_IN_USE",
        message: "Cannot delete category with existing products",
      },
    });
  }
  if (childrenCount > 0) {
    return res.status(400).json({
      error: {
        code: "CATEGORY_HAS_CHILDREN",
        message: "Cannot delete category with child categories",
      },
    });
  }
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  await prisma.category.delete({ where: { id: req.params.id } });
  await createAuditLog({ action: "CATEGORY_DELETE", entity: "Category", entityId: req.params.id, userId: req.user!.id, before });
  return res.json(ok({}, "Category deleted"));
});
export default router;
