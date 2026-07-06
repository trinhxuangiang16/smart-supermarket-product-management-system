import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";

const router = Router();

const employeeSchema = z.object({
  code: z.string().trim().min(2).max(40),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  departmentId: z.string().min(1),
  position: z.string().trim().min(2).max(120),
  hireDate: z.coerce.date(),
  salary: z.coerce.number().min(0),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
  userId: z.string().optional().or(z.literal("")),
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["fullName", "code", "hireDate", "salary", "createdAt"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

const normalize = (data: z.infer<typeof employeeSchema>) => ({
  ...data,
  status: data.status ?? "ACTIVE",
  email: data.email || null,
  phone: data.phone || null,
  userId: data.userId || null,
});

const validateRefs = async (data: ReturnType<typeof normalize>, currentId?: string) => {
  const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
  if (!department) return "Department not found";
  if (data.userId) {
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return "Linked user account not found";
    const linked = await prisma.employee.findFirst({ where: { userId: data.userId, ...(currentId ? { id: { not: currentId } } : {}) } });
    if (linked) return "This user account is already linked to another employee";
  }
  return null;
};

router.get("/", requireAuth, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } });
  const q = parsed.data;
  const where: Record<string, unknown> = {};
  if (q.search) where.OR = [{ fullName: { contains: q.search } }, { code: { contains: q.search } }, { email: { contains: q.search } }, { position: { contains: q.search } }];
  if (q.departmentId) where.departmentId = q.departmentId;
  if (q.status) where.status = q.status;
  const [total, items] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, role: true } },
      },
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return res.json(ok({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) }));
});

router.get("/:id", requireAuth, async (req, res) => {
  const item = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: { department: true, user: { select: { id: true, email: true, role: true } } },
  });
  if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Employee not found" } });
  return res.json(ok(item));
});

router.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  const data = normalize(parsed.data);
  const exists = await prisma.employee.findUnique({ where: { code: data.code } });
  if (exists) return res.status(409).json({ error: { code: "CONFLICT", message: "Employee code already exists" } });
  const refError = await validateRefs(data);
  if (refError) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: refError } });
  const created = await prisma.employee.create({ data });
  await createAuditLog({ action: "EMPLOYEE_CREATE", entity: "Employee", entityId: created.id, userId: req.user!.id, after: created });
  return res.status(201).json(ok(created, "Employee created"));
});

router.put("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  const before = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Employee not found" } });
  const data = normalize(parsed.data);
  const duplicate = await prisma.employee.findFirst({ where: { code: data.code, id: { not: req.params.id } } });
  if (duplicate) return res.status(409).json({ error: { code: "CONFLICT", message: "Employee code already exists" } });
  const refError = await validateRefs(data, req.params.id);
  if (refError) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: refError } });
  const updated = await prisma.employee.update({ where: { id: req.params.id }, data });
  await createAuditLog({ action: "EMPLOYEE_UPDATE", entity: "Employee", entityId: updated.id, userId: req.user!.id, before, after: updated });
  return res.json(ok(updated, "Employee updated"));
});

router.delete("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const before = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Employee not found" } });
  await prisma.employee.delete({ where: { id: req.params.id } });
  await createAuditLog({ action: "EMPLOYEE_DELETE", entity: "Employee", entityId: req.params.id, userId: req.user!.id, before });
  return res.json(ok({ id: req.params.id }, "Employee deleted"));
});

export default router;
