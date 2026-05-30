import { Router } from "express";
import { computeExpiryStatus } from "../../lib/expiry.js";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";

const router = Router();

let lastJobRuns: Record<string, { status: "IDLE" | "SUCCESS" | "FAILED"; startedAt?: string; finishedAt?: string; summary?: any }> = {
  expirySync: { status: "IDLE" },
  kpiSnapshot: { status: "IDLE" },
};

router.get("/jobs", requireAuth, requireRole("ADMIN", "MANAGER"), async (_req, res) => {
  return res.json(ok(lastJobRuns));
});

router.post("/jobs/expiry-sync/run", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const startedAt = new Date().toISOString();
  lastJobRuns.expirySync = { status: "IDLE", startedAt };

  try {
    const products = await prisma.product.findMany({
      where: { isDeleted: false, expiryStatus: { not: "DESTROYED" } },
      select: { id: true, expiryDate: true, expiryStatus: true },
    });
    let updated = 0;
    for (const product of products) {
      const nextStatus = computeExpiryStatus(product.expiryDate ?? null);
      if (nextStatus !== product.expiryStatus) {
        await prisma.product.update({
          where: { id: product.id },
          data: { expiryStatus: nextStatus },
        });
        updated += 1;
      }
    }
    const summary = { scanned: products.length, updated };
    const finishedAt = new Date().toISOString();
    lastJobRuns.expirySync = { status: "SUCCESS", startedAt, finishedAt, summary };
    await createAuditLog({
      action: "AUTOMATION_EXPIRY_SYNC_RUN",
      entity: "AutomationJob",
      entityId: "expirySync",
      userId: req.user!.id,
      after: { summary, startedAt, finishedAt },
    });
    return res.json(ok({ summary, startedAt, finishedAt }, "Expiry sync completed"));
  } catch (error: any) {
    const finishedAt = new Date().toISOString();
    lastJobRuns.expirySync = { status: "FAILED", startedAt, finishedAt, summary: { error: error?.message || "Unknown error" } };
    return res.status(500).json({ error: { code: "JOB_FAILED", message: "Expiry sync failed" } });
  }
});

router.post("/jobs/kpi-snapshot/run", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const startedAt = new Date().toISOString();
  lastJobRuns.kpiSnapshot = { status: "IDLE", startedAt };
  try {
    const [totalProducts, totalStockValue, lowStockProducts, expiredProducts, pendingApprovals] = await Promise.all([
      prisma.product.count({ where: { isDeleted: false } }),
      prisma.product.aggregate({ where: { isDeleted: false }, _sum: { currentStock: true, costPrice: true } }),
      prisma.product.count({ where: { isDeleted: false, currentStock: { lte: 5 } } }),
      prisma.product.count({ where: { isDeleted: false, expiryStatus: "EXPIRED" } }),
      prisma.approvalRequest.count({ where: { status: "PENDING" } }),
    ]);
    const summary = {
      totalProducts,
      lowStockProducts,
      expiredProducts,
      pendingApprovals,
      stockValueRaw: {
        sumStock: Number(totalStockValue._sum.currentStock ?? 0),
        sumCost: Number(totalStockValue._sum.costPrice ?? 0),
      },
    };
    const finishedAt = new Date().toISOString();
    lastJobRuns.kpiSnapshot = { status: "SUCCESS", startedAt, finishedAt, summary };
    await createAuditLog({
      action: "AUTOMATION_KPI_SNAPSHOT_RUN",
      entity: "AutomationJob",
      entityId: "kpiSnapshot",
      userId: req.user!.id,
      after: { summary, startedAt, finishedAt },
    });
    return res.json(ok({ summary, startedAt, finishedAt }, "KPI snapshot completed"));
  } catch (error: any) {
    const finishedAt = new Date().toISOString();
    lastJobRuns.kpiSnapshot = { status: "FAILED", startedAt, finishedAt, summary: { error: error?.message || "Unknown error" } };
    return res.status(500).json({ error: { code: "JOB_FAILED", message: "KPI snapshot failed" } });
  }
});

export default router;
