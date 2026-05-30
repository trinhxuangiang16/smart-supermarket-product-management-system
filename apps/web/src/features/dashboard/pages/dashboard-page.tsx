import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, CircleDollarSign, Package, TrendingDown, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api-client";
import { Card } from "../../../components/ui/basic";
import { actionLabel, actorLabel, buildFieldDiffs, describeActivity, targetLabel } from "../../../lib/audit-detail";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const colors: Record<string, string> = {
  NORMAL: "#16a34a",
  WARNING_15: "#d97706",
  ALERT_3: "#ea580c",
  EXPIRED: "#dc2626",
  DESTROYED: "#6b7280",
};

const activityBadgeClass = (action?: string) => {
  if (!action) return "bg-slate-100 text-slate-700";
  if (action.includes("CREATE") || action.includes("_IN")) return "bg-emerald-100 text-emerald-700";
  if (action.includes("UPDATE") || action.includes("_OUT")) return "bg-blue-100 text-blue-700";
  if (action.includes("DELETE") || action.includes("DESTROY") || action.includes("REJECT")) return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
};

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-US") : "-";
const renderJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

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
    { key: "totalProducts", label: "Total Products", icon: Package, color: "text-blue-600", preset: "all" },
    { key: "totalStockValue", label: "Total Stock Value", icon: CircleDollarSign, color: "text-emerald-600", preset: "stockValue" },
    { key: "expiringSoon", label: "Expiring Soon", icon: AlertTriangle, color: "text-amber-600", preset: "expiringSoon" },
    { key: "expired", label: "Expired", icon: Archive, color: "text-red-600", preset: "expired" },
    { key: "lowStock", label: `Low Stock (<= ${lowStockThreshold})`, icon: TrendingDown, color: "text-orange-600", preset: "lowStock" },
  ];

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
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-slate-500">{c.label}</div>
                    <div className="mt-2 text-lg font-semibold">{value}</div>
                  </div>
                  <Icon size={18} className={c.color} />
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Expiry Distribution</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expiry.data?.data ?? []} dataKey="count" nameKey="status" outerRadius={100} innerRadius={55} paddingAngle={3}>
                  {(expiry.data?.data ?? []).map((entry: any) => (
                    <Cell key={entry.status} fill={colors[entry.status] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Stock Value by Category</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockByCategory.data?.data ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => currency.format(v)} />
                <Bar dataKey="stockValue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Recent Transactions</h2>
          <span className="text-xs text-slate-500">Latest {recentActivityLimit} database activities</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Entity</th>
                <th className="px-3 py-2 text-left">Target</th>
                <th className="px-3 py-2 text-left">By</th>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {activity.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading activities...</td>
                </tr>
              ) : null}
              {(activity.data?.data ?? []).map((row: any) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${activityBadgeClass(row.action)}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.entity}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{targetLabel(row)}</div>
                    <div className="text-xs text-slate-500">{describeActivity(row)}</div>
                  </td>
                  <td className="px-3 py-2">{row.user?.name ?? row.user?.email ?? "-"}</td>
                  <td className="px-3 py-2">{formatDateTime(row.createdAt)}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setSelectedActivityId(row.id)}
                      className={`h-8 rounded px-3 text-xs font-medium ${activityBadgeClass(row.action)}`}
                    >
                      More detail
                    </button>
                  </td>
                </tr>
              ))}
              {!activity.isLoading && !(activity.data?.data ?? []).length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">No recent activity.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedActivityId ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-md border bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Activity Detail</h2>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${activityBadgeClass(activityDetail.data?.data?.action)}`}>
                    {actionLabel(activityDetail.data?.data?.action) ?? "Loading"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Clear summary and field-level changes for this action.</p>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded border text-slate-600 hover:bg-slate-50"
                onClick={() => setSelectedActivityId(null)}
                aria-label="Close activity detail"
              >
                <X size={16} />
                </button>
              </div>
            {activityDetail.isLoading ? (
              <div className="p-5 text-sm text-slate-500">Loading activity detail...</div>
            ) : (
              <div className="max-h-[75vh] space-y-4 overflow-auto p-5">
                <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  {describeActivity(activityDetail.data?.data)}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">What</div>
                    <div className="font-medium">{actionLabel(activityDetail.data?.data?.action)}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">Entity</div>
                    <div className="font-medium">{activityDetail.data?.data?.entity ?? "-"}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">Target</div>
                    <div className="font-medium">{targetLabel(activityDetail.data?.data)}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">When</div>
                    <div className="font-medium">{formatDateTime(activityDetail.data?.data?.createdAt)}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">Actor</div>
                    <div className="font-medium">{actorLabel(activityDetail.data?.data)}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">Entity ID</div>
                    <div className="break-all font-medium">{activityDetail.data?.data?.entityId ?? "-"}</div>
                  </div>
                </div>

                {activityDiffs.length ? (
                  <section className="rounded border">
                    <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">Changed Fields</div>
                    <div className="overflow-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead>
                          <tr className="border-b bg-slate-50">
                            <th className="px-3 py-2 text-left">Field</th>
                            <th className="px-3 py-2 text-left">Before</th>
                            <th className="px-3 py-2 text-left">After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityDiffs.map((diff) => (
                            <tr key={diff.field} className="border-b last:border-0">
                              <td className="px-3 py-2 font-medium">{diff.label}</td>
                              <td className="px-3 py-2 text-red-700">{diff.before}</td>
                              <td className="px-3 py-2 text-emerald-700">{diff.after}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}

                <details className="rounded border">
                  <summary className="cursor-pointer bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    Technical data (JSON)
                  </summary>
                  <div className="grid gap-3 p-3 md:grid-cols-2">
                    <section className="rounded border">
                      <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">Before</div>
                      <pre className="max-h-72 overflow-auto p-3 text-xs">{renderJson(activityDetail.data?.data?.before)}</pre>
                    </section>
                    <section className="rounded border">
                      <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">After</div>
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
