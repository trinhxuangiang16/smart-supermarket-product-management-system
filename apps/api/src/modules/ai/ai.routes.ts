import { Router } from "express";
import { z } from "zod";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";
import { chatWithFallback, getAiSettings, upsertAiSetting } from "./ai.service.js";
import { PROVIDER_ORDER } from "./providers.js";

const router = Router();

const providerSchema = z.enum(["groq", "gemini", "claude", "openai"]);

const settingsUpdateSchema = z.object({
  settings: z.array(z.object({
    provider: providerSchema,
    apiKey: z.string().max(512).optional(),
    model: z.string().max(120).optional(),
    enabled: z.boolean().optional(),
  })).min(1),
});

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1).max(20000),
  })).min(1).max(50),
  provider: providerSchema.optional(),
});

router.get("/settings", requireAuth, requireRole("ADMIN", "MANAGER"), async (_req, res) => {
  return res.json(ok(await getAiSettings()));
});

router.put("/settings", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: AuthRequest, res) => {
  const parsed = settingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  const before = await getAiSettings();
  for (const entry of parsed.data.settings) {
    await upsertAiSetting(entry.provider, entry);
  }
  const after = await getAiSettings();
  // Audit the safe view only — never the apiKey values
  await createAuditLog({
    action: "AI_SETTINGS_UPDATE",
    entity: "AiSetting",
    entityId: parsed.data.settings.map((s) => s.provider).join(","),
    userId: req.user!.id,
    before,
    after,
  });
  return res.json(ok(after, "AI settings updated"));
});

router.post("/chat", requireAuth, async (req: AuthRequest, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  }
  try {
    const result = await chatWithFallback(parsed.data.messages, { provider: parsed.data.provider });
    return res.json(ok(result));
  } catch (err) {
    return res.status(502).json({ error: { code: "AI_PROVIDER_ERROR", message: (err as Error).message } });
  }
});

router.get("/providers", requireAuth, async (_req, res) => res.json(ok(PROVIDER_ORDER)));

export default router;
