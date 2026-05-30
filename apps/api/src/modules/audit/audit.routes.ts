import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { requireAuth } from "../../middleware/require-auth.js";

const router = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  requestId: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

const toCsv = (headers: string[], rows: Array<Array<string | number>>) => {
  const esc = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
};

router.get("/actions", requireAuth, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query",
        details: parsed.error.flatten(),
      },
    });
  }
  const { page, pageSize, search, action, entity, requestId, userId, from, to } = parsed.data;
  const where: any = {};
  if (search) {
    where.OR = [
      { action: { contains: search } },
      { entity: { contains: search } },
      { requestId: { contains: search } },
      { user: { name: { contains: search } } },
      { user: { email: { contains: search } } },
    ];
  }
  if (action) where.action = action;
  if (entity) where.entity = entity;
  if (requestId) where.requestId = requestId;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where: where as any }),
    prisma.auditLog.findMany({
      where: where as any,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return res.json(ok({ items, total, page, pageSize }));
});

router.get("/actions/export.csv", requireAuth, async (req, res) => {
  const parsed = querySchema.omit({ page: true, pageSize: true }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query",
        details: parsed.error.flatten(),
      },
    });
  }
  const { search, action, entity, requestId, userId, from, to } = parsed.data;
  const where: any = {};
  if (search) {
    where.OR = [
      { action: { contains: search } },
      { entity: { contains: search } },
      { requestId: { contains: search } },
      { user: { name: { contains: search } } },
      { user: { email: { contains: search } } },
    ];
  }
  if (action) where.action = action;
  if (entity) where.entity = entity;
  if (requestId) where.requestId = requestId;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }

  const rows = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const csv = toCsv(
    ["created_at", "request_id", "action", "entity", "entity_id", "actor_name", "actor_email", "actor_role"],
    rows.map((row: any) => [
      new Date(row.createdAt).toISOString(),
      row.requestId ?? "-",
      row.action,
      row.entity,
      row.entityId,
      row.user?.name ?? "-",
      row.user?.email ?? "-",
      row.user?.role ?? "-",
    ]),
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-actions.csv"');
  res.send(csv);
});

router.get("/actions/:id", requireAuth, async (req, res) => {
  const action = await prisma.auditLog.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!action) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Action not found" } });
  let inventoryTransaction: any = null;
  if (action.entity === "InventoryTransaction") {
    inventoryTransaction = await prisma.inventoryTransaction.findUnique({
      where: { id: action.entityId },
      include: {
        product: true,
        performedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }
  return res.json(ok({ ...action, inventoryTransaction }));
});

router.get("/transaction/:id", requireAuth, async (req, res) => {
  const tx = await prisma.inventoryTransaction.findUnique({
    where: { id: req.params.id },
    include: {
      product: true,
      performedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!tx) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Transaction not found" } });
  return res.json(ok(tx));
});

router.get("/timeline/:requestId", requireAuth, async (req, res) => {
  const items = await prisma.auditLog.findMany({
    where: { requestId: req.params.requestId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
    take: 300,
  });
  return res.json(ok(items));
});

export default router;
