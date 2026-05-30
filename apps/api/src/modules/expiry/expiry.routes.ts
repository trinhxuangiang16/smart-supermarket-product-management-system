import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { requireAuth } from "../../middleware/require-auth.js";
const router = Router();
router.get("/alerts", requireAuth, async (_req, res) => res.json(ok(await prisma.product.findMany({ where: { expiryStatus: { in: ["ALERT_3", "WARNING_15"] } } }))));
router.get("/critical", requireAuth, async (_req, res) => res.json(ok(await prisma.product.findMany({ where: { expiryStatus: "ALERT_3" } }))));
router.post("/suggest-promo", requireAuth, async (req, res) => {
  const productId = req.body?.productId as string;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });
  const map: Record<string, string> = { ALERT_3: "discount 20-30%", WARNING_15: "discount 10-15%", EXPIRED: "destroy", NORMAL: "monitor", DESTROYED: "already destroyed" };
  return res.json(ok({ productId, suggestion: map[product.expiryStatus] ?? "monitor" }, "Rule-based suggestion (MVP stub, not AI)"));
});
export default router;
