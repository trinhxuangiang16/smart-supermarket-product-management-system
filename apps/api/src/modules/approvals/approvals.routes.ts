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
const approveSchema = z.object({
  reviewNote: z.string().trim().min(3).max(500).optional(),
});
const rejectSchema = z.object({
  reviewNote: z.string().trim().min(3).max(500),
});

const jsonSafe = (value: unknown) => JSON.parse(JSON.stringify(value));

type WorkflowRole = "MANAGER" | "ADMIN";
type WorkflowApproval = { userId: string; role: WorkflowRole; at: string };
type ApprovalWorkflow = { requiredRoles: WorkflowRole[]; approvedBy: WorkflowApproval[] };

const pickWorkflowRoles = (requesterRole: string, type: "PRODUCT_UPDATE" | "PRODUCT_DELETE"): WorkflowRole[] => {
  if (type === "PRODUCT_DELETE") {
    if (requesterRole === "ADMIN") return ["ADMIN"];
    if (requesterRole === "MANAGER") return ["ADMIN"];
    return ["MANAGER", "ADMIN"];
  }
  if (requesterRole === "ADMIN") return ["ADMIN"];
  if (requesterRole === "MANAGER") return ["ADMIN"];
  return ["MANAGER"];
};

const readWorkflow = (raw: unknown, fallbackRoles: WorkflowRole[]): ApprovalWorkflow => {
  const base = { requiredRoles: fallbackRoles, approvedBy: [] as WorkflowApproval[] };
  if (!raw || typeof raw !== "object") return base;
  const candidate = (raw as any).__workflow;
  if (!candidate || typeof candidate !== "object") return base;
  const requiredRoles = Array.isArray(candidate.requiredRoles)
    ? candidate.requiredRoles.filter((role: string) => role === "MANAGER" || role === "ADMIN")
    : fallbackRoles;
  const approvedBy = Array.isArray(candidate.approvedBy)
    ? candidate.approvedBy.filter((item: any) => item?.userId && (item?.role === "MANAGER" || item?.role === "ADMIN") && item?.at)
    : [];
  return {
    requiredRoles: requiredRoles.length ? requiredRoles : fallbackRoles,
    approvedBy,
  };
};

const withWorkflow = (payload: Record<string, unknown>, workflow: ApprovalWorkflow) => ({
  ...payload,
  __workflow: workflow,
});

const canUserActOnRequest = (request: any, userRole: string) => {
  const fallbackRoles = pickWorkflowRoles(request.requestedBy?.role ?? "WAREHOUSE_STAFF", request.type);
  const workflow = readWorkflow(request.requestedChanges, fallbackRoles);
  const nextRequiredRole = workflow.requiredRoles[workflow.approvedBy.length] ?? null;
  return nextRequiredRole === userRole;
};

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

  const workflow: ApprovalWorkflow = {
    requiredRoles: pickWorkflowRoles(req.user!.role, parsed.data.type),
    approvedBy: [],
  };
  const request = await prisma.approvalRequest.create({
    data: {
      type: parsed.data.type,
      productId: product.id,
      requestedById: req.user!.id,
      reason: parsed.data.reason,
      requestedChanges: jsonSafe(withWorkflow((parsed.data.type === "PRODUCT_UPDATE" ? (parsed.data.requestedChanges ?? {}) : {}), workflow)),
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

router.get("/pending-count", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const rows = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    include: { requestedBy: { select: { role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const count = rows.filter((item: any) => canUserActOnRequest(item, req.user!.role)).length;
  return res.json(ok({ count }));
});

router.get("/pending", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const items = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    include: {
      product: { include: { category: true, supplier: true } },
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const enriched = items.map((item: any) => {
    const fallbackRoles = pickWorkflowRoles(item.requestedBy.role, item.type);
    const workflow = readWorkflow(item.requestedChanges, fallbackRoles);
    const nextRequiredRole = workflow.requiredRoles[workflow.approvedBy.length] ?? null;
    return { ...item, workflow, nextRequiredRole };
  }).filter((item: any) => item.nextRequiredRole === req.user!.role);
  return res.json(ok(enriched));
});

router.post("/:id/approve", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const approveParsed = approveSchema.safeParse(req.body ?? {});
  if (!approveParsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid approval payload",
        details: approveParsed.error.flatten(),
      },
    });
  }
  const request = await prisma.approvalRequest.findUnique({
    where: { id: req.params.id },
    include: { product: true, requestedBy: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!request) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Approval request not found" } });
  if (request.status !== "PENDING") return res.status(409).json({ error: { code: "ALREADY_REVIEWED", message: "Approval request already reviewed" } });
  if (request.requestedById === req.user!.id) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Requester cannot approve own request" } });

  const fallbackRoles = pickWorkflowRoles(request.requestedBy.role, request.type);
  const workflow = readWorkflow(request.requestedChanges, fallbackRoles);
  const stepIndex = workflow.approvedBy.length;
  const requiredRole = workflow.requiredRoles[stepIndex];
  if (!requiredRole) {
    return res.status(409).json({ error: { code: "WORKFLOW_ERROR", message: "Approval workflow is already complete" } });
  }
  if (req.user!.role !== requiredRole) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: `This step requires ${requiredRole} approval` } });
  }
  if (workflow.approvedBy.some((entry) => entry.userId === req.user!.id)) {
    return res.status(409).json({ error: { code: "ALREADY_REVIEWED", message: "You already approved this request" } });
  }

  const nextWorkflow: ApprovalWorkflow = {
    ...workflow,
    approvedBy: [...workflow.approvedBy, { userId: req.user!.id, role: req.user!.role as WorkflowRole, at: new Date().toISOString() }],
  };
  const isFinalStep = nextWorkflow.approvedBy.length >= nextWorkflow.requiredRoles.length;

  if (!isFinalStep) {
    const waiting = await prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        requestedChanges: jsonSafe(withWorkflow((request.requestedChanges as any) ?? {}, nextWorkflow)),
        ...(approveParsed.data.reviewNote ? { reviewNote: approveParsed.data.reviewNote } : {}),
      },
      include: {
        product: true,
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    await createAuditLog({
      action: "APPROVAL_STEP_APPROVE",
      entity: "ApprovalRequest",
      entityId: request.id,
      userId: req.user!.id,
      before: request,
      after: waiting,
    });
    return res.json(ok({ ...waiting, workflow: nextWorkflow, nextRequiredRole: nextWorkflow.requiredRoles[nextWorkflow.approvedBy.length] ?? null }, "Step approved, waiting for next role"));
  }

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
      data: {
        status: "APPROVED",
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        ...(approveParsed.data.reviewNote ? { reviewNote: approveParsed.data.reviewNote } : {}),
        requestedChanges: jsonSafe(withWorkflow((request.requestedChanges as any) ?? {}, nextWorkflow)),
      },
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
  const rejectParsed = rejectSchema.safeParse(req.body ?? {});
  if (!rejectParsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Reject requires review note",
        details: rejectParsed.error.flatten(),
      },
    });
  }
  const request = await prisma.approvalRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Approval request not found" } });
  if (request.status !== "PENDING") return res.status(409).json({ error: { code: "ALREADY_REVIEWED", message: "Approval request already reviewed" } });

  const reviewed = await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { status: "REJECTED", reviewedById: req.user!.id, reviewedAt: new Date(), reviewNote: rejectParsed.data.reviewNote },
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
