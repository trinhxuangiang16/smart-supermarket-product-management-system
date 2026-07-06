import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";
import { analyzeTopic } from "./insights.service.js";

const router = Router();

const analyzeSchema = z.object({
  topic: z.enum(["hr", "inventory", "strategy"]),
  params: z.record(z.unknown()).default({}),
  forceRefresh: z.boolean().optional(),
});

router.post("/analyze", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  try {
    const result = await analyzeTopic(parsed.data.topic, parsed.data.params, { forceRefresh: parsed.data.forceRefresh });
    if (!result.cached) {
      await createAuditLog({
        action: "INSIGHTS_ANALYZE",
        entity: "InsightRun",
        entityId: parsed.data.topic,
        userId: req.user!.id,
        after: { topic: parsed.data.topic, provider: result.provider, model: result.model },
      });
    }
    return res.json(ok(result));
  } catch (err) {
    return res.status(502).json({ error: { code: "AI_PROVIDER_ERROR", message: (err as Error).message } });
  }
});

router.get("/recent", requireAuth, requireRole("ADMIN", "MANAGER"), async (_req, res) => {
  const runs = await prisma.insightRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, topic: true, createdAt: true },
  });
  return res.json(ok(runs));
});

export default router;
