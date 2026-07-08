import { ComponentType, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bar as RechartsBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis as RechartsXAxis, YAxis as RechartsYAxis } from "recharts";

const XAxis = RechartsXAxis as unknown as ComponentType<any>;
const YAxis = RechartsYAxis as unknown as ComponentType<any>;
const Tooltip = RechartsTooltip as unknown as ComponentType<any>;
const Bar = RechartsBar as unknown as ComponentType<any>;
import { Lightbulb, ListChecks, RefreshCw, Sparkles } from "lucide-react";
import { api } from "../../../lib/api-client";
import { Button, Card } from "../../../components/ui/basic";

type InsightTopic = "hr" | "inventory" | "strategy";

type InsightResult = {
  topic: InsightTopic;
  summary: string;
  findings: string[];
  recommendations: string[];
  metrics: Record<string, any>;
  provider?: string;
  model?: string;
  cached: boolean;
  generatedAt: string;
};

const getTopics = (t: any): Array<{ id: InsightTopic; label: string; description: string }> => [
  { id: "hr", label: t("pages.insights.topics.hr.label"), description: t("pages.insights.topics.hr.description") },
  { id: "inventory", label: t("pages.insights.topics.inventory.label"), description: t("pages.insights.topics.inventory.description") },
  { id: "strategy", label: t("pages.insights.topics.strategy.label"), description: t("pages.insights.topics.strategy.description") },
];

const chartFor = (result: InsightResult, t: any): { title: string; data: Array<{ name: string; value: number }> } | null => {
  const m = result.metrics ?? {};
  if (result.topic === "hr" && Array.isArray(m.byDepartment) && m.byDepartment.length) {
    return {
      title: t("pages.insights.charts.headcount"),
      data: m.byDepartment.map((d: any) => ({ name: d.department, value: d.headcount })),
    };
  }
  if (result.topic === "inventory" && Array.isArray(m.topStockValueByCategory) && m.topStockValueByCategory.length) {
    return {
      title: t("pages.insights.charts.stockValue"),
      data: m.topStockValueByCategory.map((d: any) => ({ name: d.category, value: d.stockValue })),
    };
  }
  if (result.topic === "strategy" && Array.isArray(m.monthlySales) && m.monthlySales.length) {
    return {
      title: t("pages.insights.charts.monthlySales"),
      data: m.monthlySales.map((d: any) => ({ name: d.month, value: d.value })),
    };
  }
  return null;
};

export const InsightsPage = () => {
  const { t } = useTranslation();
  const [topic, setTopic] = useState<InsightTopic>("inventory");
  const [result, setResult] = useState<InsightResult | null>(null);
  const [error, setError] = useState("");
  const topics = getTopics(t);

  const analyzeMutation = useMutation({
    mutationFn: (input: { topic: InsightTopic; forceRefresh?: boolean }) =>
      api<any>("/insights/analyze", {
        method: "POST",
        body: JSON.stringify({ topic: input.topic, params: {}, forceRefresh: input.forceRefresh ?? false }),
      }),
    onSuccess: (res) => {
      setResult(res?.data ?? null);
      setError("");
    },
    onError: (e) => setError((e as Error).message),
  });

  const chart = result ? chartFor(result, t) : null;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold"><Sparkles size={16} /> {t("pages.insights.title")}</h2>
        <p className="mb-3 text-xs text-muted-warm">
          {t("pages.insights.description")}
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setTopic(t.id)}
              className={`rounded-md border p-3 text-left transition ${topic === t.id ? "border-[#bb9645] bg-[#f7ebd5]" : "border-[#ead6aa] bg-[#fff9ee] hover:bg-[#f7ebd5]/60"}`}
            >
              <div className="font-medium">{t.label}</div>
              <div className="mt-1 text-xs text-muted-warm">{t.description}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            className="inline-flex items-center gap-2"
            onClick={() => analyzeMutation.mutate({ topic })}
            disabled={analyzeMutation.isPending}
          >
            <Sparkles size={14} />
            {analyzeMutation.isPending ? "Đang phân tích..." : "Chạy phân tích"}
          </Button>
          {result ? (
            <Button
              className="btn-muted-warm inline-flex items-center gap-2"
              onClick={() => analyzeMutation.mutate({ topic, forceRefresh: true })}
              disabled={analyzeMutation.isPending}
            >
              <RefreshCw size={14} /> Re-run (bỏ cache)
            </Button>
          ) : null}
        </div>
        {error ? <p className="mt-2 text-sm text-[#9c4326]">{error}</p> : null}
      </Card>

      {result ? (
        <>
          <Card>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">Tóm tắt</h3>
              <div className="text-xs text-muted-warm">
                {result.cached ? "Từ cache" : `Provider: ${result.provider} / ${result.model}`} · {new Date(result.generatedAt).toLocaleString("vi-VN")}
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6">{result.summary}</p>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="mb-2 flex items-center gap-2 text-base font-semibold"><ListChecks size={16} /> Phát hiện</h3>
              {result.findings.length ? (
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
                  {result.findings.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              ) : <p className="text-sm text-muted-warm">Không có phát hiện dạng cấu trúc (xem tóm tắt).</p>}
            </Card>
            <Card>
              <h3 className="mb-2 flex items-center gap-2 text-base font-semibold"><Lightbulb size={16} /> Khuyến nghị</h3>
              {result.recommendations.length ? (
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
                  {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              ) : <p className="text-sm text-muted-warm">Không có khuyến nghị dạng cấu trúc (xem tóm tắt).</p>}
            </Card>
          </div>

          {chart ? (
            <Card>
              <h3 className="mb-3 text-base font-semibold">{chart.title}</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart.data} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ead6aa" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => v.toLocaleString("en-US")} />
                    <Bar dataKey="value" fill="#bb9645" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
