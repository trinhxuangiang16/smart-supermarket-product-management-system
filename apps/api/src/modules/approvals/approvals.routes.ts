import { Router } from "express";
import { z } from "zod";
import { computeExpiryStatus } from "../../lib/expiry.js";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { requireAuth, AuthRequest } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";

const router = Router();

const productUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  brand: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  sku: z.string().min(2).optional(),
  barcode: z.string().optional().nullable(),
  type: z.enum(["FRESH_FOOD", "DRY_GOODS", "COSMETICS", "HOUSEHOLD", "CUSTOM"]).optional(),
  unit: z.enum(["PIECE", "KG", "G", "L", "ML", "BOX"]).optional(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  productionDate: z.string().datetime().optional().nullable(),
  expiryDate: z.string().datetime().optional().nullable(),
  imageUrl: z.string().url().optional().or(z.literal("")).nullable(),
  notes: z.string().optional().nullable(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional().nullable(),
});

const requestSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["PRODUCT_UPDATE", "PRODUCT_DELETE"]),
  reason: z.string().trim().min(8, "Reason must be at least 8 characters"),
  requestedChanges: productUpdateSchema.optional(),
});

const jsonSafe = (value: unknown) => JSON.parse(JSON.stringify(value));

const normalizeProductUpdate = (changes: z.infer<typeof productUpdateSchema>) => {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (key === "productionDate" || key === "expiryDate") {
      data[key] = value ? new Date(String(value)) : null;
    } else if (key === "brand" || key === "manufacturer" || key === "barcode" || key === "supplierId" || key === "imageUrl") {
      data[key] = value || null;
    } else {
      data[key] = value;
    }
  }
  return data;
};

router.post("/product", requireAuth, requireRole("ADMIN", "MANAGER", "WAREHOUSE_STAFF", "CASHIER"), async (req: AuthRequest, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid approval request",
        details: parsed.error.flatten(),
      },
    });
  }

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, isDeleted: false },
  });
  if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });

  if (parsed.data.type === "PRODUCT_UPDATE" && !parsed.data.requestedChanges) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Update request requires changes" } });
  }

  const request = await prisma.approvalRequest.create({
    data: {
      type: parsed.data.type,
      productId: product.id,
      requestedById: req.user!.id,
      reason: parsed.data.reason,
      requestedChanges: parsed.data.type === "PRODUCT_UPDATE" ? jsonSafe(parsed.data.requestedChanges) : undefined,
      before: jsonSafe(product),
    },
    include: {
      product: true,
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  await createAuditLog({
    action: "APPROVAL_REQUEST_CREATE",
    entity: "ApprovalRequest",
    entityId: request.id,
    userId: req.user!.id,
    after: request,
  });

  return res.status(201).json(ok(request, "Approval request sent"));
});

router.get("/pending-count", requireAuth, requireRole("ADMIN", "MANAGER"), async (_req, res) => {
  const count = await prisma.approvalRequest.count({ where: { status: "PENDING" } });
  return res.json(ok({ count }));
});

router.get("/pending", requireAuth, requireRole("ADMIN", "MANAGER"), async (_req, res) => {
  const items = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    include: {
      product: { include: { category: true, supplier: true } },
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return res.json(ok(items));
});

router.post("/:id/approve", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: req.params.id },
    include: { product: true, requestedBy: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!request) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Approval request not found" } });
  if (request.status !== "PENDING") return res.status(409).json({ error: { code: "ALREADY_REVIEWED", message: "Approval request already reviewed" } });

  const result = await prisma.$transaction(async (tx: any) => {
    let productAfter: unknown = null;
    if (request.type === "PRODUCT_UPDATE") {
      const requestedChanges = (request.requestedChanges ?? {}) as Record<string, unknown>;
      const updateData = normalizeProductUpdate(requestedChanges);
      const oldCostPrice = Number(request.product.costPrice);
      const oldSellingPrice = Number(request.product.sellingPrice);
      const costPrice = Number(updateData.costPrice ?? oldCostPrice);
      const sellingPrice = Number(updateData.sellingPrice ?? oldSellingPrice);
      const nextExpiryDate = Object.prototype.hasOwnProperty.call(updateData, "expiryDate")
        ? updateData.expiryDate as Date | null
        : request.product.expiryDate;
      updateData.profitMargin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;
      updateData.expiryStatus = computeExpiryStatus(nextExpiryDate);
      productAfter = await tx.product.update({ where: { id: request.productId }, data: updateData });
      if (oldCostPrice !== costPrice || oldSellingPrice !== sellingPrice) {
        await tx.priceHistory.create({
          data: {
            productId: request.productId,
            oldCostPrice,
            newCostPrice: costPrice,
            oldSellingPrice,
            newSellingPrice: sellingPrice,
            changedById: req.user!.id,
          },
        });
      }
    } else {
      productAfter = await tx.product.update({
        where: { id: request.productId },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    }

    const reviewed = await tx.approvalRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedById: req.user!.id, reviewedAt: new Date() },
      include: {
        product: true,
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        action: request.type === "PRODUCT_UPDATE" ? "PRODUCT_UPDATE_APPROVED" : "PRODUCT_DELETE_APPROVED",
        entity: "ApprovalRequest",
        entityId: request.id,
        userId: req.user!.id,
        before: request.before as any,
        after: jsonSafe({ request: reviewed, product: productAfter }),
      },
    });

    return reviewed;
  });

  return res.json(ok(result, "Approval request approved"));
});

router.post("/:id/reject", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const request = await prisma.approvalRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Approval request not found" } });
  if (request.status !== "PENDING") return res.status(409).json({ error: { code: "ALREADY_REVIEWED", message: "Approval request already reviewed" } });

  const reviewed = await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { status: "REJECTED", reviewedById: req.user!.id, reviewedAt: new Date() },
    include: {
      product: true,
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      reviewedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  await createAuditLog({
    action: "APPROVAL_REJECT",
    entity: "ApprovalRequest",
    entityId: request.id,
    userId: req.user!.id,
    before: request,
    after: reviewed,
  });

  return res.json(ok(reviewed, "Approval request rejected"));
});

export default router;
