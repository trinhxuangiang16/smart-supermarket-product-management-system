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
});

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
  const { page, pageSize, search } = parsed.data;
  const where = search
    ? {
        OR: [
          { action: { contains: search } },
          { entity: { contains: search } },
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
        ],
      }
    : {};
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

export default router;

