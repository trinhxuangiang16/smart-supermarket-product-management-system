import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";

const router = Router();
const txSchema = z.object({
  productId: z.string(),
  quantity: z.number().refine((value) => value !== 0, "Quantity must not be zero"),
  unitPrice: z.number().nonnegative().optional(),
  reason: z.string().optional(),
  destroyReason: z.enum(["EXPIRED", "DAMAGED", "CONTAMINATED", "OTHER"]).optional(),
  invoiceNumber: z.string().optional(),
  supplierName: z.string().optional(),
  deliveredByName: z.string().optional(),
  deliveredAt: z.string().datetime().optional(),
});
type TxType = "IN" | "OUT" | "ADJUSTMENT" | "DESTROY";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "DESTROY"]).optional(),
  productId: z.string().optional(),
  search: z.string().trim().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const createTx = (type: TxType) => async (req: AuthRequest, res: any) => {
  const p = txSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: p.error.flatten() } });
  const product = await prisma.product.findFirst({ where: { id: p.data.productId, isDeleted: false } });
  if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });
  if (product.expiryStatus === "DESTROYED") {
    return res.status(400).json({ error: { code: "INVALID_OPERATION", message: "Destroyed products cannot be transacted" } });
  }
  if (type !== "ADJUSTMENT" && p.data.quantity <= 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Quantity must be greater than zero" } });
  }
  if ((type === "OUT" || type === "DESTROY") && product.expiryStatus === "EXPIRED" && !["ADMIN", "MANAGER"].includes(req.user!.role)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admin/manager can operate expired stock" } });
  }
  if (type === "DESTROY") {
    if (!p.data.destroyReason) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Destroy reason is required" } });
    if (p.data.quantity <= 0) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Destroy quantity must be greater than zero" } });
  }

  const currentStock = Number(product.currentStock);
  const absoluteQty = Math.abs(p.data.quantity);
  const txQuantity = type === "ADJUSTMENT" ? p.data.quantity : absoluteQty;
  const delta = type === "IN" ? absoluteQty : type === "OUT" || type === "DESTROY" ? -absoluteQty : p.data.quantity;
  const nextStock = currentStock + delta;
  if (nextStock < 0) return res.status(400).json({ error: { code: "INVALID_STOCK", message: "Stock cannot go below zero" } });

  const result = await prisma.$transaction(async (tx: any) => {
    const updatedProduct = await tx.product.update({
      where: { id: product.id },
      data: { currentStock: nextStock, ...(type === "DESTROY" ? { expiryStatus: "DESTROYED" } : {}) },
    });
    const transaction = await tx.inventoryTransaction.create({
      data: {
        productId: product.id,
        type,
        quantity: txQuantity,
        unitPrice: p.data.unitPrice ?? null,
        totalValue: p.data.unitPrice ? p.data.unitPrice * absoluteQty : null,
        invoiceNumber: p.data.invoiceNumber ?? null,
        supplierName: p.data.supplierName ?? null,
        deliveredByName: p.data.deliveredByName ?? null,
        deliveredAt: p.data.deliveredAt ? new Date(p.data.deliveredAt) : null,
        reason: p.data.reason,
        destroyReason: p.data.destroyReason,
        performedById: req.user!.id,
      },
    });
    return { updatedProduct, transaction };
  });

  await createAuditLog({ action: `INVENTORY_${type}`, entity: "InventoryTransaction", entityId: result.transaction.id, userId: req.user!.id, after: result.transaction });
  return res.status(201).json(ok(result, "Inventory transaction created"));
};

router.post("/in", requireAuth, requireRole("ADMIN", "MANAGER", "WAREHOUSE_STAFF"), createTx("IN"));
router.post("/out", requireAuth, requireRole("ADMIN", "MANAGER", "CASHIER"), createTx("OUT"));
router.post("/adjustment", requireAuth, requireRole("ADMIN", "MANAGER", "WAREHOUSE_STAFF"), createTx("ADJUSTMENT"));
router.post("/destroy", requireAuth, requireRole("ADMIN", "MANAGER", "WAREHOUSE_STAFF"), createTx("DESTROY"));
router.get("/transactions", requireAuth, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query params",
        details: parsed.error.flatten(),
      },
    });
  }

  const q = parsed.data;
  const where: any = {};
  if (q.type) where.type = q.type;
  if (q.productId) where.productId = q.productId;
  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: new Date(`${q.from}T00:00:00.000Z`) } : {}),
      ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}),
    };
  }
  if (q.search) {
    where.OR = [
      { reason: { contains: q.search } },
      { invoiceNumber: { contains: q.search } },
      { supplierName: { contains: q.search } },
      { deliveredByName: { contains: q.search } },
      { product: { name: { contains: q.search } } },
      { product: { sku: { contains: q.search } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.inventoryTransaction.count({ where }),
    prisma.inventoryTransaction.findMany({
      where,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { product: true, performedBy: true },
      orderBy: { createdAt: q.sortOrder },
    }),
  ]);
  res.json(ok({ items, total, page: q.page, pageSize: q.pageSize }));
});
router.get("/history/:productId", requireAuth, async (req, res) => {
  const parsed = listQuerySchema
    .pick({ page: true, pageSize: true, sortOrder: true })
    .safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query params",
        details: parsed.error.flatten(),
      },
    });
  }
  const q = parsed.data;
  const [total, items] = await Promise.all([
    prisma.inventoryTransaction.count({ where: { productId: req.params.productId } }),
    prisma.inventoryTransaction.findMany({
      where: { productId: req.params.productId },
      orderBy: { createdAt: q.sortOrder },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        performedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
  ]);
  return res.json(ok({ items, total, page: q.page, pageSize: q.pageSize }));
});
export default router;
