import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Save, Send } from "lucide-react";
import { api } from "../../../lib/api-client";
import { Button, Card, Input } from "../../../components/ui/basic";

type AiProvider = "groq" | "gemini" | "claude" | "openai";

type AiSettingView = {
  provider: AiProvider;
  model: string;
  defaultModel: string;
  enabled: boolean;
  hasKey: boolean;
  keySource: "db" | "env" | "none";
};

type FormRow = { apiKey: string; model: string; enabled: boolean };

const providerLabels: Record<AiProvider, string> = {
  groq: "Groq",
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
  openai: "OpenAI",
};

const sourceLabels: Record<AiSettingView["keySource"], string> = {
  db: "Saved in database",
  env: "From server environment",
  none: "No key configured",
};

export const AiSettingsSection = () => {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Record<string, FormRow>>({});
  const [testPrompt, setTestPrompt] = useState("Say hello in one short sentence.");
  const [testResult, setTestResult] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => api<any>("/ai/settings"),
  });

  const settings: AiSettingView[] = settingsQuery.data?.data ?? [];

  useEffect(() => {
    if (!settingsQuery.data?.data) return;
    const next: Record<string, FormRow> = {};
    for (const s of settingsQuery.data.data as AiSettingView[]) {
      next[s.provider] = { apiKey: "", model: s.model, enabled: s.enabled };
    }
    setRows(next);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = settings.map((s) => {
        const row = rows[s.provider];
        return {
          provider: s.provider,
          ...(row?.apiKey ? { apiKey: row.apiKey } : {}),
          model: row?.model ?? s.model,
          enabled: row?.enabled ?? s.enabled,
        };
      });
      return api<any>("/ai/settings", { method: "PUT", body: JSON.stringify({ settings: payload }) });
    },
    onSuccess: async () => {
      setMessage("AI settings saved.");
      setError("");
      await qc.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (e) => {
      setError((e as Error).message);
      setMessage("");
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api<any>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: testPrompt }] }),
    }),
    onSuccess: (result) => {
      setTestResult(`[${result?.data?.provider} / ${result?.data?.model}] ${result?.data?.content}`);
      setError("");
    },
    onError: (e) => {
      setTestResult("");
      setError((e as Error).message);
    },
  });

  return (
    <Card>
      <h3 className="mb-1 flex items-center gap-2 text-base font-semibold"><Bot size={16} /> AI Providers</h3>
      <p className="mb-3 text-xs text-muted-warm">
        Configure API keys per provider. Keys are stored server-side and never shown again after saving.
        Chat requests try enabled providers in order: Groq, Gemini, Claude, OpenAI.
      </p>
      {message ? <p className="mb-2 text-sm text-[#315f3d]">{message}</p> : null}
      {error ? <p className="mb-2 text-sm text-[#9c4326]">{error}</p> : null}

      <div className="space-y-3">
        {settingsQuery.isLoading ? <p className="text-sm text-muted-warm">Loading AI settings...</p> : null}
        {settings.map((s) => {
          const row = rows[s.provider] ?? { apiKey: "", model: s.model, enabled: s.enabled };
          return (
            <div key={s.provider} className="rounded-md border border-[#ead6aa] bg-[#fff9ee]/70 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{providerLabels[s.provider]}</span>
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${s.hasKey ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {s.hasKey ? "Key configured" : "No key"}
                  </span>
                  <span className="text-xs text-muted-warm">{sourceLabels[s.keySource]}</span>
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => setRows({ ...rows, [s.provider]: { ...row, enabled: e.target.checked } })}
                  />
                  Enabled
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-muted-warm">API key {s.hasKey ? "(leave blank to keep current)" : ""}</div>
                  <Input
                    type="password"
                    placeholder={s.hasKey ? "••••••••" : "Enter API key"}
                    value={row.apiKey}
                    onChange={(e) => setRows({ ...rows, [s.provider]: { ...row, apiKey: e.target.value } })}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-warm">Model (default: {s.defaultModel})</div>
                  <Input
                    value={row.model}
                    onChange={(e) => setRows({ ...rows, [s.provider]: { ...row, model: e.target.value } })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-warm">Only ADMIN and MANAGER can view or change AI settings.</p>
        <Button
          className="inline-flex items-center gap-2"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || settingsQuery.isLoading}
        >
          <Save size={14} />
          {saveMutation.isPending ? "Saving..." : "Save AI Settings"}
        </Button>
      </div>

      <div className="mt-4 rounded-md border border-[#ead6aa] bg-[#f7ebd5] p-3">
        <div className="mb-2 text-sm font-semibold">Test chat</div>
        <div className="flex gap-2">
          <Input value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} />
          <Button
            className="inline-flex items-center gap-2 whitespace-nowrap"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !testPrompt.trim()}
          >
            <Send size={14} />
            {testMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
        {testResult ? <p className="mt-2 whitespace-pre-wrap text-sm text-[#315f3d]">{testResult}</p> : null}
      </div>
    </Card>
  );
};
