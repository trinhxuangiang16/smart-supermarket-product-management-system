import { prisma } from "../../lib/prisma.js";
import { ChatMessage, PROVIDER_ORDER, PROVIDERS, ProviderName } from "./providers.js";

export type AiSettingView = {
  provider: ProviderName;
  model: string;
  defaultModel: string;
  enabled: boolean;
  hasKey: boolean;
  keySource: "db" | "env" | "none";
};

type ResolvedProvider = {
  name: ProviderName;
  apiKey: string | null;
  model: string;
  enabled: boolean;
  keySource: "db" | "env" | "none";
};

type AiSettingRow = { provider: string; apiKey: string | null; model: string | null; enabled: boolean };

const resolveProviders = async (): Promise<ResolvedProvider[]> => {
  const rows: AiSettingRow[] = await prisma.aiSetting.findMany();
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return PROVIDER_ORDER.map((name) => {
    const def = PROVIDERS[name];
    const row = byProvider.get(name);
    const envKey = process.env[def.envKey]?.trim() || null;
    const dbKey = row?.apiKey?.trim() || null;
    return {
      name,
      apiKey: dbKey ?? envKey,
      model: row?.model?.trim() || def.defaultModel,
      enabled: row?.enabled ?? true,
      keySource: dbKey ? "db" : envKey ? "env" : "none",
    };
  });
};

export const getAiSettings = async (): Promise<AiSettingView[]> => {
  const resolved = await resolveProviders();
  return resolved.map((p) => ({
    provider: p.name,
    model: p.model,
    defaultModel: PROVIDERS[p.name].defaultModel,
    enabled: p.enabled,
    hasKey: Boolean(p.apiKey),
    keySource: p.keySource,
  }));
};

export const upsertAiSetting = async (
  provider: ProviderName,
  input: { apiKey?: string | null; model?: string | null; enabled?: boolean },
) => {
  const data: { apiKey?: string | null; model?: string | null; enabled?: boolean } = {};
  if (input.apiKey !== undefined) data.apiKey = input.apiKey === "" ? null : input.apiKey;
  if (input.model !== undefined) data.model = input.model === "" ? null : input.model;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  return prisma.aiSetting.upsert({
    where: { provider },
    create: { provider, ...data },
    update: data,
  });
};

export type ChatResult = { provider: ProviderName; model: string; content: string };

export const chatWithFallback = async (
  messages: ChatMessage[],
  options?: { provider?: ProviderName },
): Promise<ChatResult> => {
  const resolved = await resolveProviders();
  const candidates = options?.provider
    ? resolved.filter((p) => p.name === options.provider)
    : resolved;
  const usable = candidates.filter((p) => p.enabled && p.apiKey);
  if (!usable.length) {
    throw new Error("No AI provider is configured. Add an API key in AI settings or environment variables.");
  }
  const errors: string[] = [];
  for (const p of usable) {
    try {
      const content = await PROVIDERS[p.name].call(p.apiKey!, p.model, messages);
      return { provider: p.name, model: p.model, content };
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
};
