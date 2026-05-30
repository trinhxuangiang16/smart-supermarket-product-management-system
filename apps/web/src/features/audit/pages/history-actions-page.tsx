import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getToken } from "../../../lib/api-client";
import { Card, Input } from "../../../components/ui/basic";
import { actionLabel, actorLabel, buildFieldDiffs, describeActivity, targetLabel } from "../../../lib/audit-detail";

const actionClass = (action: string) => {
  if (action.includes("CREATE") || action.includes("_IN")) return "bg-emerald-100 text-emerald-700";
  if (action.includes("UPDATE") || action.includes("_OUT")) return "bg-blue-100 text-blue-700";
  if (action.includes("DELETE") || action.includes("DESTROY") || action.includes("REJECT")) return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
};
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-US") : "-";
const renderJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

export const HistoryActionsPage = () => {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const query = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    search,
    action: actionFilter,
    entity: entityFilter,
    from,
    to,
  }).toString();

  const actions = useQuery({
    queryKey: ["audit-actions", query],
    queryFn: () => api<any>(`/audit/actions?${query}`),
  });

  const actionDetail = useQuery({
    queryKey: ["action-detail", selectedActionId],
    queryFn: () => api<any>(`/audit/actions/${selectedActionId}`),
    enabled: Boolean(selectedActionId),
  });
  const actionDiffs = buildFieldDiffs(actionDetail.data?.data?.before, actionDetail.data?.data?.after);
  const exportCsv = async () => {
    const response = await fetch(`http://localhost:4000/api/audit/actions/export.csv?${query}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = "audit-actions.csv";
    a.click();
    URL.revokeObjectURL(fileUrl);
  };

  const rows = actions.data?.data?.items ?? [];
  const total = Number(actions.data?.data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const queryError = actions.error as Error | null;

  return (
    <div className="space-y-4">
      {queryError ? (
        <Card>
          <p className="text-sm text-red-600">{queryError.message}</p>
        </Card>
      ) : null}
      <Card>
        <div className="grid gap-2 md:grid-cols-5">
          <Input
            placeholder="Search by action, entity, user..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Input placeholder="Action" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} />
          <Input placeholder="Entity" value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }} />
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div className="mt-2 flex justify-end">
          <button className="h-9 rounded border px-3 text-xs hover:bg-slate-50" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </Card>
      <Card>
        <div className="overflow-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Entity</th>
                <th className="px-3 py-2 text-left">By</th>
                <th className="px-3 py-2 text-left">At</th>
                <th className="px-3 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {actions.isLoading ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Loading history...</td></tr>
              ) : null}
              {rows.map((row: any) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                  <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${actionClass(row.action)}`}>
                      {actionLabel(row.action)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.entity}</td>
                  <td className="px-3 py-2">{actorLabel(row)}</td>
                  <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2">
                    <button
                      className={`h-8 rounded px-3 text-xs font-medium ${actionClass(row.action)}`}
                      onClick={() => setSelectedActionId(row.id)}
                    >
                      More detail
                    </button>
                  </td>
                </tr>
              ))}
              {!actions.isLoading && !rows.length ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No audit actions found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-500">Total actions: {total}</span>
          <div className="flex items-center gap-2">
            <button className="h-9 rounded border px-3 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
              Previous
            </button>
            <span>Page {page} / {totalPages}</span>
            <button className="h-9 rounded border px-3 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>
              Next
            </button>
          </div>
        </div>
      </Card>

      {selectedActionId ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-5xl rounded-md border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Audit Detail</h2>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${actionClass(actionDetail.data?.data?.action ?? "")}`}>
                    {actionLabel(actionDetail.data?.data?.action) ?? "DETAIL"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Clear summary and field-level changes for selected action.</p>
              </div>
              <button
                className="h-9 rounded border bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setSelectedActionId(null)}
              >
                Close
              </button>
            </div>
            {actionDetail.isLoading ? (
              <div className="p-5 text-sm text-slate-500">Loading detail...</div>
            ) : (
              <div className="max-h-[75vh] space-y-4 overflow-auto p-5">
                <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  {describeActivity(actionDetail.data?.data)}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">What</div>
                    <div className="font-medium">{actionLabel(actionDetail.data?.data?.action)}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">Entity</div>
                    <div className="font-medium">{actionDetail.data?.data?.entity ?? "-"}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">Target</div>
                    <div className="font-medium">{targetLabel(actionDetail.data?.data)}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">When</div>
                    <div className="font-medium">{formatDateTime(actionDetail.data?.data?.createdAt)}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">Actor</div>
                    <div className="font-medium">{actorLabel(actionDetail.data?.data)}</div>
                  </div>
                  <div className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="text-xs text-slate-500">Entity ID</div>
                    <div className="break-all font-medium">{actionDetail.data?.data?.entityId ?? "-"}</div>
                  </div>
                </div>

                {actionDiffs.length ? (
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
                          {actionDiffs.map((diff) => (
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
                      <pre className="max-h-72 overflow-auto p-3 text-xs">{renderJson(actionDetail.data?.data?.before)}</pre>
                    </section>
                    <section className="rounded border">
                      <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">After</div>
                      <pre className="max-h-72 overflow-auto p-3 text-xs">{renderJson(actionDetail.data?.data?.after)}</pre>
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
