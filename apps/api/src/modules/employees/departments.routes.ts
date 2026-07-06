import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";

const router = Router();

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  parentId: z.string().optional().or(z.literal("")),
});

router.get("/", requireAuth, async (_req, res) => {
  const items = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { employees: true, children: true } },
    },
  });
  return res.json(ok(items));
});

router.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  const parentId = parsed.data.parentId || null;
  if (parentId) {
    const parent = await prisma.department.findUnique({ where: { id: parentId } });
    if (!parent) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Parent department not found" } });
  }
  const exists = await prisma.department.findUnique({ where: { name: parsed.data.name } });
  if (exists) return res.status(409).json({ error: { code: "CONFLICT", message: "Department name already exists" } });
  const created = await prisma.department.create({ data: { name: parsed.data.name, parentId } });
  await createAuditLog({ action: "DEPARTMENT_CREATE", entity: "Department", entityId: created.id, userId: req.user!.id, after: created });
  return res.status(201).json(ok(created, "Department created"));
});

router.put("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  const before = await prisma.department.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Department not found" } });
  const parentId = parsed.data.parentId || null;
  if (parentId === req.params.id) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Department cannot be its own parent" } });
  const updated = await prisma.department.update({ where: { id: req.params.id }, data: { name: parsed.data.name, parentId } });
  await createAuditLog({ action: "DEPARTMENT_UPDATE", entity: "Department", entityId: updated.id, userId: req.user!.id, before, after: updated });
  return res.json(ok(updated, "Department updated"));
});

router.delete("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const before = await prisma.department.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { employees: true, children: true } } },
  });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Department not found" } });
  if (before._count.employees > 0 || before._count.children > 0) {
    return res.status(409).json({ error: { code: "CONFLICT", message: "Cannot delete department with employees or child departments" } });
  }
  await prisma.department.delete({ where: { id: req.params.id } });
  await createAuditLog({ action: "DEPARTMENT_DELETE", entity: "Department", entityId: req.params.id, userId: req.user!.id, before });
  return res.json(ok({ id: req.params.id }, "Department deleted"));
});

export default router;
