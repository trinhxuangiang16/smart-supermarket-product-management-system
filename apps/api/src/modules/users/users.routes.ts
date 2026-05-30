import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "../../lib/password.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";
const router = Router();

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "MANAGER", "WAREHOUSE_STAFF", "CASHIER", "SALE_DEPARTMENT", "FINANCE_DEPARTMENT"]),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "MANAGER", "WAREHOUSE_STAFF", "CASHIER", "SALE_DEPARTMENT", "FINANCE_DEPARTMENT"]).optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum(["ADMIN", "MANAGER", "WAREHOUSE_STAFF", "CASHIER", "SALE_DEPARTMENT", "FINANCE_DEPARTMENT"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "email", "createdAt", "role"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } });
  }

  const q = parsed.data;
  const where = {
    ...(q.search ? {
      OR: [
        { name: { contains: q.search } },
        { email: { contains: q.search } },
      ],
    } : {}),
    ...(q.role ? { role: q.role } : {}),
    ...(q.isActive ? { isActive: q.isActive === "true" } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      orderBy: { [q.sortBy]: q.sortOrder },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return res.json(ok({ items, total, page: q.page, pageSize: q.pageSize }));
});

router.get("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  });
  if (!user) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
  return res.json(ok(user));
});

router.post("/", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  if (parsed.data.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount > 0) {
      return res.status(409).json({ error: { code: "CONFLICT", message: "System allows only one admin account" } });
    }
  }
  if (req.user!.role !== "ADMIN" && parsed.data.role === "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admin can create admin users" } });
  }
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: { code: "CONFLICT", message: "Email already exists" } });
  const created = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role as any,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
  await createAuditLog({ action: "USER_CREATE", entity: "User", entityId: created.id, userId: req.user!.id, after: created });
  return res.status(201).json(ok(created, "User created"));
});

router.put("/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
  if (target.id === req.user!.id && parsed.data.isActive === false) {
    return res.status(400).json({ error: { code: "INVALID_OPERATION", message: "You cannot deactivate your own account" } });
  }
  if (req.user!.role !== "ADMIN" && target.role === "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admin can modify admin users" } });
  }
  if (req.user!.role !== "ADMIN" && parsed.data.role === "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admin can assign admin role" } });
  }
  if (parsed.data.role === "ADMIN" && target.role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount > 0) {
      return res.status(409).json({ error: { code: "CONFLICT", message: "System allows only one admin account" } });
    }
  }
  if (target.role === "ADMIN" && parsed.data.role && parsed.data.role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return res.status(400).json({ error: { code: "INVALID_OPERATION", message: "System must keep exactly one admin account" } });
    }
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.role ? { role: parsed.data.role as any } : {}),
      ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {}),
    },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
  await createAuditLog({ action: "USER_UPDATE", entity: "User", entityId: updated.id, userId: req.user!.id, before: target, after: updated });
  return res.json(ok(updated, "User updated"));
});

router.patch("/:id/password", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
  if (req.user!.role !== "ADMIN" && target.role === "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admin can reset admin password" } });
  }

  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  await createAuditLog({
    action: "USER_PASSWORD_RESET",
    entity: "User",
    entityId: req.params.id,
    userId: req.user!.id,
    after: { id: req.params.id },
  });
  return res.json(ok({ id: req.params.id }, "Password reset"));
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: { code: "INVALID_OPERATION", message: "You cannot delete your own account" } });
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
  await prisma.user.delete({ where: { id: req.params.id } });
  await createAuditLog({ action: "USER_DELETE", entity: "User", entityId: req.params.id, userId: req.user!.id, before: target });
  return res.json(ok({}, "User deleted"));
});

export default router;
