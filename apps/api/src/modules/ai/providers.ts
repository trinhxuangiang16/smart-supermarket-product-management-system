export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ProviderName = "groq" | "gemini" | "claude" | "openai";

export interface ProviderDefinition {
  name: ProviderName;
  envKey: string;
  defaultModel: string;
  call: (apiKey: string, model: string, messages: ChatMessage[]) => Promise<string>;
}

// Free-tier providers first so chatWithFallback prefers them
export const PROVIDER_ORDER: ProviderName[] = ["groq", "gemini", "claude", "openai"];

const readJsonOrThrow = async (res: Response, provider: string) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message ?? body?.message ?? `HTTP ${res.status}`;
    throw new Error(`${provider}: ${message}`);
  }
  return body;
};

const callOpenAiCompatible = (baseUrl: string, provider: string) =>
  async (apiKey: string, model: string, messages: ChatMessage[]): Promise<string> => {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages }),
    });
    const body = await readJsonOrThrow(res, provider);
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error(`${provider}: empty response`);
    return content;
  };

const callGemini = async (apiKey: string, model: string, messages: ChatMessage[]): Promise<string> => {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => ({ text: m.content }));
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
        contents,
      }),
    },
  );
  const body = await readJsonOrThrow(res, "gemini");
  const content = (body?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? "")
    .join("");
  if (!content) throw new Error("gemini: empty response");
  return content;
};

const callClaude = async (apiKey: string, model: string, messages: ChatMessage[]): Promise<string> => {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages: chatMessages,
    }),
  });
  const body = await readJsonOrThrow(res, "claude");
  const content = (body?.content ?? [])
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b?.text ?? "")
    .join("");
  if (!content) throw new Error("claude: empty response");
  return content;
};

export const PROVIDERS: Record<ProviderName, ProviderDefinition> = {
  groq: {
    name: "groq",
    envKey: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    call: callOpenAiCompatible("https://api.groq.com/openai/v1", "groq"),
  },
  gemini: {
    name: "gemini",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-2.0-flash",
    call: callGemini,
  },
  claude: {
    name: "claude",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-haiku-4-5",
    call: callClaude,
  },
  openai: {
    name: "openai",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    call: callOpenAiCompatible("https://api.openai.com/v1", "openai"),
  },
};
