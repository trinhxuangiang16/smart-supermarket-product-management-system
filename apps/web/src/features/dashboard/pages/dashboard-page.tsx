import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, CircleDollarSign, Package, TrendingDown, X } from "lucide-react";
import { Bar as RechartsBar, BarChart, CartesianGrid, Cell, Pie as RechartsPie, PieChart, ResponsiveContainer, Sector as RechartsSector, Tooltip as RechartsTooltip, XAxis as RechartsXAxis, YAxis as RechartsYAxis } from "recharts";
import { useState } from "react";
import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api-client";
import { Card } from "../../../components/ui/basic";
import { auditActionBadgeClass, auditActionButtonClass } from "../../../lib/audit-action-style";
import { actionLabel, actorLabel, buildFieldDiffs, describeActivity, targetLabel } from "../../../lib/audit-detail";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const colors: Record<string, string> = {
  NORMAL: "#86ad86",
  WARNING_15: "#bc943d",
  ALERT_3: "#d07048",
  EXPIRED: "#bf6451",
  DESTROYED: "#6f654f",
};

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-US") : "-";
const renderJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);
const Pie = RechartsPie as unknown as ComponentType<any>;
const Tooltip = RechartsTooltip as unknown as ComponentType<any>;
const XAxis = RechartsXAxis as unknown as ComponentType<any>;
const YAxis = RechartsYAxis as unknown as ComponentType<any>;
const Bar = RechartsBar as unknown as ComponentType<any>;
const Sector = RechartsSector as unknown as ComponentType<any>;
const chartTooltipStyle = {
  backgroundColor: "#fff8e8",
  border: "1px solid #d7bd7a",
  borderRadius: 8,
  boxShadow: "0 12px 26px rgba(82, 50, 19, 0.18)",
  color: "#3f2b12",
};
const RADIAN = Math.PI / 180;

const renderExpiryPieLabel = ({ cx, cy, midAngle, outerRadius, percent, name, payload }: any) => {
  if (!percent || percent < 0.01) return null;

  const centerX = Number(cx);
  const centerY = Number(cy);
  const radius = Number(outerRadius);
  const cos = Math.cos(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);
  const startX = centerX + radius * cos;
  const startY = centerY + radius * sin;
  const midX = centerX + (radius + 18) * cos;
  const midY = centerY + (radius + 18) * sin;
  const endX = centerX + (radius + 46) * cos;
  const endY = centerY + (radius + 46) * sin;
  const textX = endX + (cos >= 0 ? 8 : -8);
  const anchor = cos >= 0 ? "start" : "end";
  const percentLabel = `${(percent * 100).toFixed(percent >= 0.1 ? 0 : 1)}%`;
  const stroke = colors[payload?.status] ?? "#7a6b4f";

  return (
    <g>
      <path
        d={`M${startX},${startY} L${midX},${midY} L${endX},${endY}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        opacity={0.82}
      />
      <circle cx={startX} cy={startY} r={2.5} fill={stroke} opacity={0.9} />
      <text x={textX} y={endY - 3} textAnchor={anchor} fill="#15371f" fontSize={11} fontWeight={700}>
        {percentLabel}
      </text>
      <text x={textX} y={endY + 11} textAnchor={anchor} fill="#6f654f" fontSize={10} fontWeight={600}>
        {String(name ?? "").replaceAll("_", " ")}
      </text>
    </g>
  );
};

const renderActiveExpiryShape = ({
  cx,
  cy,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  fill,
  payload,
  percent,
  value,
}: any) => {
  const percentLabel = `${((percent ?? 0) * 100).toFixed((percent ?? 0) >= 0.1 ? 0 : 1)}%`;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#fff8e8"
        strokeWidth={3}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 12}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.36}
      />
      <text x={cx} y={cy - 9} textAnchor="middle" fill="#15371f" fontSize={16} fontWeight={800}>
        {percentLabel}
      </text>
      <text x={cx} y={cy + 7} textAnchor="middle" fill="#6f654f" fontSize={10} fontWeight={700}>
        {String(payload?.status ?? "").replaceAll("_", " ")}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill="#7a6b4f" fontSize={10} fontWeight={600}>
        {Number(value ?? 0).toLocaleString("en-US")} items
      </text>
    </g>
  );
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activeExpiryIndex, setActiveExpiryIndex] = useState<number | null>(null);

  const systemSettings = useQuery({
    queryKey: ["settings-system"],
    queryFn: () => api<any>("/settings/system"),
    staleTime: 300000,
  });
  const activityRefreshMs = Math.max(
    2000,
    Number(systemSettings.data?.data?.operations?.dashboardActivityRefreshSeconds ?? 4) * 1000,
  );
  const recentActivityLimit = Math.max(
    3,
    Number(systemSettings.data?.data?.operations?.recentActivityLimit ?? 5),
  );
  const kpi = useQuery({ queryKey: ["kpi"], queryFn: () => api<any>("/dashboard/overview") });
  const activity = useQuery({
    queryKey: ["recent"],
    queryFn: () => api<any>("/dashboard/recent-transactions"),
    refetchInterval: activityRefreshMs,
  });
  const expiry = useQuery({ queryKey: ["expiry-dis"], queryFn: () => api<any>("/dashboard/expiry-distribution") });
  const stockByCategory = useQuery({ queryKey: ["stock-by-cat"], queryFn: () => api<any>("/dashboard/stock-value-by-category") });
  const activityDetail = useQuery({
    queryKey: ["dashboard-activity-detail", selectedActivityId],
    queryFn: () => api<any>(`/audit/actions/${selectedActivityId}`),
    enabled: Boolean(selectedActivityId),
  });
  const activityDiffs = buildFieldDiffs(activityDetail.data?.data?.before, activityDetail.data?.data?.after);

  const lowStockThreshold = Number(
    kpi.data?.data?.lowStockThreshold
    ?? systemSettings.data?.data?.operations?.lowStockThreshold
    ?? 5,
  );

  const cards = [
    { key: "totalProducts", label: "Total Products", icon: Package, preset: "all", cardClass: "from-[#d66b36] via-[#bd4e24] to-[#8f3518]" },
    { key: "totalStockValue", label: "Total Stock Value", icon: CircleDollarSign, preset: "stockValue", cardClass: "from-[#d0ad4b] via-[#b98e2e] to-[#805f1c]" },
    { key: "expiringSoon", label: "Expiring Soon", icon: AlertTriangle, preset: "expiringSoon", cardClass: "from-[#e3c45b] via-[#c79f3d] to-[#8e681f]" },
    { key: "expired", label: "Expired", icon: Archive, preset: "expired", cardClass: "from-[#d47b68] via-[#ba5948] to-[#87352c]" },
    { key: "lowStock", label: `Low Stock (<= ${lowStockThreshold})`, icon: TrendingDown, preset: "lowStock", cardClass: "from-[#e07b48] via-[#c95f36] to-[#983d1f]" },
  ];
  const expiryData = expiry.data?.data ?? [];
  const expiryTotal = expiryData.reduce((sum: number, entry: any) => sum + Number(entry.count ?? 0), 0);
  const activeExpiry = activeExpiryIndex === null ? null : expiryData[activeExpiryIndex];
  const activeExpiryPercent = activeExpiry && expiryTotal
    ? `${((Number(activeExpiry.count ?? 0) / expiryTotal) * 100).toFixed(Number(activeExpiry.count ?? 0) / expiryTotal >= 0.1 ? 0 : 1)}%`
    : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          const raw = kpi.data?.data?.[c.key] ?? 0;
          const value = c.key === "totalStockValue" ? currency.format(raw) : String(raw);
          return (
            <div
              key={c.key}
              className="cursor-pointer transition-transform hover:-translate-y-0.5"
              onClick={() => navigate(`/products?preset=${c.preset}`)}
            >
              <div className={`rounded-md bg-gradient-to-br ${c.cardClass} p-5 text-white shadow-[0_14px_30px_rgba(82,50,19,0.22)] ring-1 ring-white/20`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-none text-white drop-shadow-[0_1px_1px_rgba(53,27,9,0.42)]">{c.label}</div>
                    <div className="mt-3 truncate text-2xl font-bold leading-none tracking-tight text-white drop-shadow-[0_2px_3px_rgba(53,27,9,0.36)]">{value}</div>
                  </div>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_16px_rgba(70,38,14,0.16)] ring-1 ring-white/30">
                    <Icon size={21} strokeWidth={2.4} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card overflow-hidden rounded-lg border border-[#e0cfa5] bg-gradient-to-br from-[#fffaf0] to-[#f4ead4] p-5 shadow-[0_18px_34px_rgba(82,50,19,0.14)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-[#86ad86]" />
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#15371f]">Expiry Distribution</h2>
              <p className="text-xs font-medium text-[#7a6b4f]">Current product expiry status mix</p>
            </div>
          </div>
          <div className="rounded-lg border border-[#eadfc4] bg-[#fff9ec]/70 p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(118px,0.32fr)] md:items-start">
              <div className="h-56 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 12, right: 48, bottom: 12, left: 36 }}>
                    <Pie
                      data={expiryData}
                      dataKey="count"
                      nameKey="status"
                      outerRadius={70}
                      innerRadius={38}
                      paddingAngle={4}
                      stroke="#fff8e8"
                      strokeWidth={4}
                      label={renderExpiryPieLabel}
                      labelLine={false}
                      activeIndex={activeExpiryIndex ?? undefined}
                      activeShape={renderActiveExpiryShape}
                      isAnimationActive
                      animationBegin={120}
                      animationDuration={900}
                      animationEasing="ease-out"
                      onMouseEnter={(_: unknown, index: number) => setActiveExpiryIndex(index)}
                      onMouseLeave={() => setActiveExpiryIndex(null)}
                    >
                      {expiryData.map((entry: any) => (
                        <Cell key={entry.status} fill={colors[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <div className="rounded-md border border-[#eadfc4] bg-[#fffaf0] px-2.5 py-2">
                  <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#7a6b4f]">
                    {activeExpiry ? String(activeExpiry.status).replaceAll("_", " ") : "Total tracked products"}
                  </div>
                  <div className="mt-0.5 text-base font-extrabold leading-none text-[#15371f]">
                    {activeExpiry ? Number(activeExpiry.count ?? 0).toLocaleString("en-US") : expiryTotal.toLocaleString("en-US")}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-[#7a6b4f]">
                    {activeExpiry ? `${activeExpiryPercent} · items` : "items"}
                  </div>
                </div>
                <div className="grid gap-2">
                  {expiryData.map((entry: any, index: number) => {
                    const count = Number(entry.count ?? 0);
                    const percent = expiryTotal ? (count / expiryTotal) * 100 : 0;
                    const isActive = activeExpiryIndex === index;
                    const color = colors[entry.status] ?? "#94a3b8";
                    return (
                      <button
                        key={entry.status}
                        type="button"
                        onMouseEnter={() => setActiveExpiryIndex(index)}
                        onMouseLeave={() => setActiveExpiryIndex(null)}
                        className={`flex items-center justify-between rounded-md border px-2.5 py-2 text-left text-xs transition-all ${isActive ? "border-[#bb9645] bg-[#f0dfb6] shadow-sm" : "border-[#eadfc4] bg-[#fffaf0] hover:border-[#d8bf7d] hover:bg-[#f8efd9]"}`}
                      >
                        <span className="flex min-w-0 items-center gap-2 font-semibold text-[#2f2110]">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate">{String(entry.status).replaceAll("_", " ")}</span>
                        </span>
                        <span className="ml-2 shrink-0 font-bold text-[#15371f]">{percent.toFixed(percent >= 10 ? 0 : 1)}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card overflow-hidden rounded-lg border border-[#e0cfa5] bg-gradient-to-br from-[#fffaf0] to-[#f4ead4] p-5 shadow-[0_18px_34px_rgba(82,50,19,0.14)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-[#c66433]" />
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#15371f]">Stock Value by Category</h2>
              <p className="text-xs font-medium text-[#7a6b4f]">Inventory value grouped by product category</p>
            </div>
          </div>
          <div className="h-72 rounded-lg border border-[#eadfc4] bg-[#fff9ec]/70 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockByCategory.data?.data ?? []} margin={{ top: 10, right: 14, left: 4, bottom: 8 }}>
                <CartesianGrid stroke="#e3d2aa" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#5f513c", fontWeight: 600 }} axisLine={{ stroke: "#cdbb91" }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#5f513c", fontWeight: 600 }} axisLine={{ stroke: "#cdbb91" }} tickLine={false} />
                <Tooltip formatter={(v: number) => currency.format(v)} contentStyle={chartTooltipStyle} cursor={{ fill: "rgba(198, 100, 51, 0.08)" }} />
                <Bar
                  dataKey="stockValue"
                  fill="#c66433"
                  radius={[7, 7, 0, 0]}
                  stroke="#9f431f"
                  strokeWidth={1}
                  isAnimationActive
                  animationBegin={180}
                  animationDuration={950}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="surface-card overflow-hidden rounded-lg border border-[#e0cfa5] bg-gradient-to-br from-[#fffaf0] to-[#f4ead4] p-5 shadow-[0_18px_34px_rgba(82,50,19,0.14)]">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-[#bb9645]" />
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#15371f]">Recent Transactions</h2>
              <p className="text-xs font-medium text-[#7a6b4f]">Latest database activity across the system</p>
            </div>
          </div>
          <span className="rounded-full border border-[#d8bf7d] bg-[#ead7a2] px-3 py-1 text-xs font-semibold text-[#6f4f13]">
            Latest {recentActivityLimit}
          </span>
        </div>
        <div className="overflow-auto rounded-lg border border-[#dfcfaa] bg-[#fff9ec]/75">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-[#d8bf7d] bg-[#e8d49d] text-[#2f2110]">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Target</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">By</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">When</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Detail</th>
              </tr>
            </thead>
            <tbody>
              {activity.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-muted)]">Loading activities...</td>
                </tr>
              ) : null}
              {(activity.data?.data ?? []).map((row: any) => (
                <tr key={row.id} className="border-b border-[#eadfc4] odd:bg-[#fffaf0] even:bg-[#f8efd9] transition-colors hover:bg-[#f0dfb6] last:border-0">
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${auditActionBadgeClass(row.action)}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#2f2110]">{row.entity}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#2f2110]">{targetLabel(row)}</div>
                    <div className="mt-0.5 text-xs font-medium text-[#7a6b4f]">{describeActivity(row)}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#2f2110]">{row.user?.name ?? row.user?.email ?? "-"}</td>
                  <td className="px-4 py-3 font-medium text-[#2f2110]">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedActivityId(row.id)}
                      className={`h-8 rounded px-3 text-xs font-semibold transition active:translate-y-px ${auditActionButtonClass(row.action)}`}
                    >
                      More detail
                    </button>
                  </td>
                </tr>
              ))}
              {!activity.isLoading && !(activity.data?.data ?? []).length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-muted)]">No recent activity.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedActivityId ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#15371f]/45 p-4">
          <div className="surface-card w-full max-w-5xl overflow-hidden rounded-md border shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Activity Detail</h2>
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${auditActionBadgeClass(activityDetail.data?.data?.action)}`}>
                    {actionLabel(activityDetail.data?.data?.action) ?? "Loading"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted)]">Clear summary and field-level changes for this action.</p>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded border border-[var(--color-border)] text-[var(--color-sidebar)] hover:bg-[#efe6d0]"
                onClick={() => setSelectedActivityId(null)}
                aria-label="Close activity detail"
              >
                <X size={16} />
                </button>
              </div>
            {activityDetail.isLoading ? (
              <div className="p-5 text-sm text-[var(--color-muted)]">Loading activity detail...</div>
            ) : (
              <div className="max-h-[75vh] space-y-4 overflow-auto p-5">
                <div className="rounded border border-[#c7a24e] bg-[#ead7a2] px-3 py-2 text-sm text-[#6f4f13]">
                  {describeActivity(activityDetail.data?.data)}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">What</div>
                    <div className="font-medium">{actionLabel(activityDetail.data?.data?.action)}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">Entity</div>
                    <div className="font-medium">{activityDetail.data?.data?.entity ?? "-"}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">Target</div>
                    <div className="font-medium">{targetLabel(activityDetail.data?.data)}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">When</div>
                    <div className="font-medium">{formatDateTime(activityDetail.data?.data?.createdAt)}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">Actor</div>
                    <div className="font-medium">{actorLabel(activityDetail.data?.data)}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">Entity ID</div>
                    <div className="break-all font-medium">{activityDetail.data?.data?.entityId ?? "-"}</div>
                  </div>
                </div>

                {activityDiffs.length ? (
                  <section className="rounded border border-[var(--color-border)]">
                    <div className="border-b border-[var(--color-border)] bg-[#efe6d0] px-3 py-2 text-sm font-semibold">Changed Fields</div>
                    <div className="overflow-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] bg-[#efe6d0]">
                            <th className="px-3 py-2 text-left">Field</th>
                            <th className="px-3 py-2 text-left">Before</th>
                            <th className="px-3 py-2 text-left">After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityDiffs.map((diff) => (
                            <tr key={diff.field} className="border-b border-[var(--color-border-soft)] last:border-0">
                              <td className="px-3 py-2 font-medium">{diff.label}</td>
                              <td className="px-3 py-2 text-[#8f2f20]">{diff.before}</td>
                              <td className="px-3 py-2 text-[#315f3d]">{diff.after}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}

                <details className="rounded border border-[var(--color-border)]">
                  <summary className="cursor-pointer bg-[#efe6d0] px-3 py-2 text-sm font-semibold text-[var(--color-sidebar)]">
                    Technical data (JSON)
                  </summary>
                  <div className="grid gap-3 p-3 md:grid-cols-2">
                    <section className="rounded border border-[var(--color-border)]">
                      <div className="border-b border-[var(--color-border)] bg-[#efe6d0] px-3 py-2 text-sm font-semibold">Before</div>
                      <pre className="max-h-72 overflow-auto p-3 text-xs">{renderJson(activityDetail.data?.data?.before)}</pre>
                    </section>
                    <section className="rounded border border-[var(--color-border)]">
                      <div className="border-b border-[var(--color-border)] bg-[#efe6d0] px-3 py-2 text-sm font-semibold">After</div>
                      <pre className="max-h-72 overflow-auto p-3 text-xs">{renderJson(activityDetail.data?.data?.after)}</pre>
                    </section>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
