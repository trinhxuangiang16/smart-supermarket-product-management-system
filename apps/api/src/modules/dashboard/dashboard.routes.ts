import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { getSystemSettings } from "../settings/settings.store.js";
const router = Router();

router.get("/overview", requireAuth, async (_req, res) => {
  const settings = await getSystemSettings();
  const lowStockThreshold = Math.max(0, Number(settings.operations.lowStockThreshold || 0));
  const [totalProducts, expiringSoon, expired, lowStock, products] = await Promise.all([
    prisma.product.count({ where: { isDeleted: false } }),
    prisma.product.count({ where: { isDeleted: false, expiryStatus: { in: ["ALERT_3", "WARNING_15"] } } }),
    prisma.product.count({ where: { isDeleted: false, expiryStatus: "EXPIRED" } }),
    prisma.product.count({ where: { isDeleted: false, currentStock: { lte: lowStockThreshold } } }),
    prisma.product.findMany({ where: { isDeleted: false }, select: { currentStock: true, costPrice: true } }),
  ]);
  const totalStockValue = products.reduce((sum: number, p: { currentStock: unknown; costPrice: unknown }) => sum + Number(p.currentStock) * Number(p.costPrice), 0);
  res.json(ok({ totalProducts, expiringSoon, expired, lowStock, totalStockValue, lowStockThreshold }));
});

router.get("/recent-transactions", requireAuth, async (_req, res) => {
  const settings = await getSystemSettings();
  const activityLimit = Math.max(3, Number(settings.operations.recentActivityLimit || 5));
  const items = await prisma.auditLog.findMany({
    take: activityLimit,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  return res.json(ok(items));
});
router.get("/expiry-distribution", requireAuth, async (_req, res) => {
  const statuses = ["NORMAL", "WARNING_15", "ALERT_3", "EXPIRED", "DESTROYED"];
  const data = await Promise.all(statuses.map(async (status) => ({ status, count: await prisma.product.count({ where: { isDeleted: false, expiryStatus: status as any } }) })));
  res.json(ok(data));
});
router.get("/stock-value-by-category", requireAuth, async (_req, res) => {
  const categories = await prisma.category.findMany({ include: { products: { where: { isDeleted: false } } } });
  res.json(ok(categories.map((c: any) => ({ category: c.name, stockValue: c.products.reduce((sum: number, p: { currentStock: unknown; costPrice: unknown }) => sum + Number(p.currentStock) * Number(p.costPrice), 0) }))));
});
export default router;
