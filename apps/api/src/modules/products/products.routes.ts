import { Router } from "express";
import { z } from "zod";
import { computeExpiryStatus } from "../../lib/expiry.js";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { requireAuth, AuthRequest } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";
import { getSystemSettings } from "../settings/settings.store.js";

const router = Router();
const productSchema = z.object({
  name: z.string().min(2), brand: z.string().optional(), manufacturer: z.string().optional(), sku: z.string().min(2), barcode: z.string().optional(), type: z.enum(["FRESH_FOOD", "DRY_GOODS", "COSMETICS", "HOUSEHOLD", "CUSTOM"]),
  unit: z.enum(["PIECE", "KG", "G", "L", "ML", "BOX"]),
  costPrice: z.number().nonnegative(), sellingPrice: z.number().nonnegative(), currentStock: z.number().nonnegative(), reorderLevel: z.number().nonnegative(),
  productionDate: z.string().datetime().optional().nullable(), expiryDate: z.string().datetime().optional().nullable(), imageUrl: z.string().url().optional().or(z.literal("")), notes: z.string().optional(),
  categoryId: z.string(), supplierId: z.string().optional().nullable(),
});

const productUpdateSchema = productSchema.omit({ currentStock: true });
const bulkArchiveSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1),
});
const importItemSchema = productSchema.extend({
  currentStock: z.number().default(0),
  overwriteBySku: z.boolean().optional(),
});
const importSchema = z.object({
  items: z.array(importItemSchema).min(1).max(1000),
});

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  expiryStatus: z.enum(["NORMAL", "WARNING_15", "ALERT_3", "EXPIRED", "DESTROYED"]).optional(),
  expiryFrom: z.string().date().optional(),
  expiryTo: z.string().date().optional(),
  stockLevel: z.enum(["LOW", "NORMAL", "OUT"]).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["updatedAt", "name", "sellingPrice", "costPrice", "currentStock", "expiryDate"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  preset: z.enum(["all", "stockValue", "expiringSoon", "expired", "lowStock"]).default("all"),
});

const toExpiryFlags = (expiryDate?: Date | null) => {
  if (!expiryDate) return { daysUntilExpiry: null, isWarning15: false, isAlert3: false };
  const now = new Date();
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / 86400000);
  return {
    daysUntilExpiry,
    isWarning15: daysUntilExpiry >= 4 && daysUntilExpiry <= 15,
    isAlert3: daysUntilExpiry >= 0 && daysUntilExpiry <= 3,
  };
};

router.get("/", requireAuth, async (req, res) => {
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
  const systemSettings = await getSystemSettings();
  const lowStockThreshold = Math.max(0, Number(systemSettings.operations.lowStockThreshold || 0));
  if (q.minPrice !== undefined && q.maxPrice !== undefined && q.minPrice > q.maxPrice) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "minPrice cannot be greater than maxPrice",
      },
    });
  }

  const where: any = {
    isDeleted: false,
  };
  if (q.search) {
    where.OR = [
      { name: { contains: q.search } },
      { sku: { contains: q.search } },
      { barcode: { contains: q.search } },
      { brand: { contains: q.search } },
      { manufacturer: { contains: q.search } },
    ];
  }
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.supplierId) where.supplierId = q.supplierId;
  if (q.expiryStatus) where.expiryStatus = q.expiryStatus;

  if (q.expiryFrom || q.expiryTo) {
    where.expiryDate = {
      ...(q.expiryFrom ? { gte: new Date(`${q.expiryFrom}T00:00:00.000Z`) } : {}),
      ...(q.expiryTo ? { lte: new Date(`${q.expiryTo}T23:59:59.999Z`) } : {}),
    };
  }

  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    where.sellingPrice = {
      ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
      ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
    };
  }

  if (q.stockLevel === "LOW") where.currentStock = { lte: lowStockThreshold };
  if (q.stockLevel === "OUT") where.currentStock = { lte: 0 };
  if (q.stockLevel === "NORMAL") where.currentStock = { gt: lowStockThreshold };

  if (q.preset === "expiringSoon") where.expiryStatus = { in: ["ALERT_3", "WARNING_15"] as any };
  if (q.preset === "expired") where.expiryStatus = "EXPIRED";
  if (q.preset === "lowStock") where.currentStock = { lte: lowStockThreshold };

  const orderBy = q.preset === "stockValue"
    ? [{ currentStock: "desc" as const }, { costPrice: "desc" as const }]
    : [{ [q.sortBy]: q.sortOrder as "asc" | "desc" }];

  const [total, data] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      orderBy,
      include: { category: true, supplier: true },
    }),
  ]);
  return res.json(ok({
    items: data.map((p: any) => ({ ...p, ...toExpiryFlags(p.expiryDate) })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    meta: { lowStockThreshold },
  }));
});

router.get("/:id", requireAuth, async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: req.params.id, isDeleted: false }, include: { category: true, supplier: true } });
  if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });
  return res.json(ok({ ...product, ...toExpiryFlags(product.expiryDate) }));
});
router.post("/", requireAuth, requireRole("ADMIN", "MANAGER", "WAREHOUSE_STAFF"), async (req: AuthRequest, res) => {
  const p = productSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: p.error.flatten() } });
  const profitMargin = p.data.costPrice > 0 ? ((p.data.sellingPrice - p.data.costPrice) / p.data.costPrice) * 100 : 0;
  const productionDate = p.data.productionDate ? new Date(p.data.productionDate) : null;
  const expiryDate = p.data.expiryDate ? new Date(p.data.expiryDate) : null;
  const created = await prisma.product.create({
    data: { ...p.data, brand: p.data.brand || null, manufacturer: p.data.manufacturer || null, barcode: p.data.barcode || null, supplierId: p.data.supplierId || null, imageUrl: p.data.imageUrl || null, productionDate, expiryDate, expiryStatus: computeExpiryStatus(expiryDate), profitMargin, createdById: req.user!.id },
  });
  await createAuditLog({ action: "PRODUCT_CREATE", entity: "Product", entityId: created.id, userId: req.user!.id, after: created });
  return res.status(201).json(ok(created, "Product created"));
});
router.put("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const p = productUpdateSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: p.error.flatten() } });
  const before = await prisma.product.findFirst({ where: { id: req.params.id, isDeleted: false } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });
  const nextCostPrice = Number(p.data.costPrice ?? before.costPrice);
  const nextSellingPrice = Number(p.data.sellingPrice ?? before.sellingPrice);
  const profitMargin = nextCostPrice > 0 ? ((nextSellingPrice - nextCostPrice) / nextCostPrice) * 100 : 0;
  const productionDate = p.data.productionDate ? new Date(p.data.productionDate) : null;
  const expiryDate = p.data.expiryDate ? new Date(p.data.expiryDate) : null;
  const updated = await prisma.$transaction(async (tx: any) => {
    const row = await tx.product.update({
      where: { id: req.params.id },
      data: { ...p.data, brand: p.data.brand || null, manufacturer: p.data.manufacturer || null, barcode: p.data.barcode || null, supplierId: p.data.supplierId || null, imageUrl: p.data.imageUrl || null, productionDate, expiryDate, expiryStatus: computeExpiryStatus(expiryDate), profitMargin },
    });
    const oldCostPrice = Number(before.costPrice);
    const oldSellingPrice = Number(before.sellingPrice);
    if (oldCostPrice !== nextCostPrice || oldSellingPrice !== nextSellingPrice) {
      await tx.priceHistory.create({
        data: {
          productId: row.id,
          oldCostPrice,
          newCostPrice: nextCostPrice,
          oldSellingPrice,
          newSellingPrice: nextSellingPrice,
          changedById: req.user!.id,
        },
      });
    }
    return row;
  });
  await createAuditLog({ action: "PRODUCT_UPDATE", entity: "Product", entityId: updated.id, userId: req.user!.id, before, after: updated });
  return res.json(ok(updated, "Product updated"));
});
router.delete("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const before = await prisma.product.findFirst({ where: { id: req.params.id, isDeleted: false } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });
  const deleted = await prisma.product.update({ where: { id: req.params.id }, data: { isDeleted: true, deletedAt: new Date() } });
  await createAuditLog({ action: "PRODUCT_DELETE", entity: "Product", entityId: req.params.id, userId: req.user!.id, before, after: deleted });
  return res.json(ok(deleted, "Product deleted"));
});

router.post("/:id/duplicate", requireAuth, requireRole("ADMIN", "MANAGER", "WAREHOUSE_STAFF"), async (req: AuthRequest, res) => {
  const original = await prisma.product.findFirst({ where: { id: req.params.id, isDeleted: false } });
  if (!original) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });

  const duplicateData = {
    name: `${original.name} (Copy)`,
    brand: original.brand,
    manufacturer: original.manufacturer,
    sku: `${original.sku}-COPY-${Date.now().toString().slice(-6)}`,
    barcode: null,
    type: original.type,
    unit: original.unit,
    costPrice: Number(original.costPrice),
    sellingPrice: Number(original.sellingPrice),
    currentStock: 0,
    reorderLevel: Number(original.reorderLevel),
    productionDate: original.productionDate,
    expiryDate: original.expiryDate,
    expiryStatus: original.expiryStatus,
    imageUrl: original.imageUrl,
    notes: original.notes,
    categoryId: original.categoryId,
    supplierId: original.supplierId,
    createdById: req.user!.id,
    profitMargin: Number(original.profitMargin),
  };

  const created = await prisma.product.create({ data: duplicateData as any });
  await createAuditLog({
    action: "PRODUCT_DUPLICATE",
    entity: "Product",
    entityId: created.id,
    userId: req.user!.id,
    before: { id: original.id, sku: original.sku, name: original.name },
    after: { id: created.id, sku: created.sku, name: created.name },
  });
  return res.status(201).json(ok(created, "Product duplicated"));
});

router.post("/bulk/archive", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = bulkArchiveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  const ids = Array.from(new Set(parsed.data.productIds));
  const before = await prisma.product.findMany({
    where: { id: { in: ids }, isDeleted: false },
    select: { id: true, name: true, sku: true, isDeleted: true },
  });
  if (!before.length) return res.status(404).json({ error: { code: "NOT_FOUND", message: "No active products found to archive" } });

  const result = await prisma.product.updateMany({
    where: { id: { in: before.map((item: any) => item.id) }, isDeleted: false },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  await createAuditLog({
    action: "PRODUCT_BULK_ARCHIVE",
    entity: "Product",
    entityId: before.map((item: any) => item.id).join(","),
    userId: req.user!.id,
    before,
    after: { archivedCount: result.count },
  });
  return res.json(ok({ archivedCount: result.count }, "Products archived"));
});

router.post("/import", requireAuth, requireRole("ADMIN", "MANAGER", "WAREHOUSE_STAFF"), async (req: AuthRequest, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  const items = parsed.data.items;
  const summary = { created: 0, updated: 0, skipped: 0 };
  const errors: Array<{ sku: string; message: string }> = [];

  for (const item of items) {
    try {
      const productionDate = item.productionDate ? new Date(item.productionDate) : null;
      const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
      const profitMargin = item.costPrice > 0 ? ((item.sellingPrice - item.costPrice) / item.costPrice) * 100 : 0;

      const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
      const payload = {
        ...item,
        brand: item.brand || null,
        manufacturer: item.manufacturer || null,
        barcode: item.barcode || null,
        supplierId: item.supplierId || null,
        imageUrl: item.imageUrl || null,
        notes: item.notes || null,
        productionDate,
        expiryDate,
        expiryStatus: computeExpiryStatus(expiryDate),
        profitMargin,
      };

      if (existing && item.overwriteBySku) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            ...payload,
            createdById: existing.createdById,
            isDeleted: false,
            deletedAt: null,
          } as any,
        });
        summary.updated += 1;
      } else if (existing) {
        summary.skipped += 1;
      } else {
        await prisma.product.create({
          data: {
            ...payload,
            createdById: req.user!.id,
          } as any,
        });
        summary.created += 1;
      }
    } catch (error: any) {
      summary.skipped += 1;
      errors.push({ sku: item.sku, message: error?.message || "Unknown error" });
    }
  }

  await createAuditLog({
    action: "PRODUCT_BULK_IMPORT",
    entity: "Product",
    entityId: "bulk",
    userId: req.user!.id,
    after: { summary, totalItems: items.length, errorCount: errors.length },
  });

  return res.json(ok({ summary, errors }, "Import finished"));
});

router.get("/:id/price-history", requireAuth, async (req, res) => {
  const parsed = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } });
  }
  const q = parsed.data;
  const where = { productId: req.params.id };
  const [total, items] = await Promise.all([
    prisma.priceHistory.count({ where }),
    prisma.priceHistory.findMany({
      where,
      include: { changedBy: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return res.json(ok({ items, total, page: q.page, pageSize: q.pageSize }));
});
export default router;
