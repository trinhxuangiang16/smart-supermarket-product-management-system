import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../../../lib/api-client";
import { Card, Input } from "../../../components/ui/basic";
import { auditActionBadgeClass, auditActionButtonClass } from "../../../lib/audit-action-style";
import { actionLabel, actorLabel, buildFieldDiffs, describeActivity, targetLabel } from "../../../lib/audit-detail";

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-US") : "-";
const renderJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);
const filterInputClass = "h-10 text-xs";

export const HistoryActionsPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [requestIdFilter, setRequestIdFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const queryParams = new URLSearchParams({
    page: String(page),
    pageSize: "20",
  });
  if (search.trim()) queryParams.set("search", search.trim());
  if (actionFilter.trim()) queryParams.set("action", actionFilter.trim());
  if (entityFilter.trim()) queryParams.set("entity", entityFilter.trim());
  if (requestIdFilter.trim()) queryParams.set("requestId", requestIdFilter.trim());
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);
  const query = queryParams.toString();

  const actions = useQuery({
    queryKey: ["audit-actions", query],
    queryFn: () => api<any>(`/audit/actions?${query}`),
  });

  const actionDetail = useQuery({
    queryKey: ["action-detail", selectedActionId],
    queryFn: () => api<any>(`/audit/actions/${selectedActionId}`),
    enabled: Boolean(selectedActionId),
  });
  const requestId = actionDetail.data?.data?.requestId as string | undefined;
  const timeline = useQuery({
    queryKey: ["audit-timeline", requestId],
    queryFn: () => api<any>(`/audit/timeline/${requestId}`),
    enabled: Boolean(requestId),
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
          <p className="text-sm text-[#9b3f2e]">{queryError.message}</p>
        </Card>
      ) : null}
      <Card>
        <div className="grid gap-2 lg:grid-cols-[1.25fr_0.9fr_0.9fr_1fr_0.95fr_0.95fr_auto] lg:items-center">
          <Input
            className={filterInputClass}
            placeholder={t("pages.audit.search.placeholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Input className={filterInputClass} placeholder={t("pages.audit.filters.action")} value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} />
          <Input className={filterInputClass} placeholder={t("pages.audit.filters.entity")} value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }} />
          <Input className={filterInputClass} placeholder={t("pages.audit.filters.requestId")} value={requestIdFilter} onChange={(e) => { setRequestIdFilter(e.target.value); setPage(1); }} />
          <Input className={filterInputClass} type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input className={filterInputClass} type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          <button className="btn-gold h-10 whitespace-nowrap rounded border px-3 text-xs font-semibold" onClick={exportCsv}>
            {t("pages.audit.filters.exportCsv")}
          </button>
        </div>
      </Card>
      <Card>
        <div className="overflow-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr>
                <th>{t("pages.audit.table.headers.action")}</th>
                <th>{t("pages.audit.table.headers.entity")}</th>
                <th>{t("pages.audit.table.headers.target")}</th>
                <th>{t("pages.audit.table.headers.by")}</th>
                <th>{t("pages.audit.table.headers.when")}</th>
                <th>{t("pages.audit.table.headers.detail")}</th>
              </tr>
              <tr className="border-b border-[var(--color-border)] bg-[#efe6d0]">
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Entity</th>
                <th className="px-3 py-2 text-left">Request ID</th>
                <th className="px-3 py-2 text-left">By</th>
                <th className="px-3 py-2 text-left">At</th>
                <th className="px-3 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {actions.isLoading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--color-muted)]">Loading history...</td></tr>
              ) : null}
              {rows.map((row: any) => (
                <tr key={row.id} className="border-b border-[var(--color-border-soft)] last:border-0">
                  <td className="px-3 py-2">
                  <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${auditActionBadgeClass(row.action)}`}>
                      {actionLabel(row.action)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.entity}</td>
                  <td className="px-3 py-2 text-xs text-[var(--color-muted)]">{row.requestId ?? "-"}</td>
                  <td className="px-3 py-2">{actorLabel(row)}</td>
                  <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2">
                    <button
                      className={`h-8 rounded px-3 text-xs font-semibold transition active:translate-y-px ${auditActionButtonClass(row.action)}`}
                      onClick={() => setSelectedActionId(row.id)}
                    >
                      More detail
                    </button>
                  </td>
                </tr>
              ))}
              {!actions.isLoading && !rows.length ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--color-muted)]">No audit actions found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">Total actions: {total}</span>
          <div className="flex items-center gap-2">
            <button className="h-9 rounded border border-[var(--color-border)] bg-[#fbf6ea] px-3 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
              Previous
            </button>
            <span>Page {page} / {totalPages}</span>
            <button className="h-9 rounded border border-[var(--color-border)] bg-[#fbf6ea] px-3 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>
              Next
            </button>
          </div>
        </div>
      </Card>

      {selectedActionId ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#15371f]/45 p-4">
          <div className="surface-card w-full max-w-5xl rounded-md border shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Audit Detail</h2>
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${auditActionBadgeClass(actionDetail.data?.data?.action)}`}>
                    {actionLabel(actionDetail.data?.data?.action) ?? "DETAIL"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted)]">Clear summary and field-level changes for selected action.</p>
              </div>
              <button
                className="h-9 rounded border border-[var(--color-border)] bg-[#fbf6ea] px-3 text-sm text-[var(--color-sidebar)] hover:bg-[#efe6d0]"
                onClick={() => setSelectedActionId(null)}
              >
                Close
              </button>
            </div>
            {actionDetail.isLoading ? (
              <div className="p-5 text-sm text-[var(--color-muted)]">Loading detail...</div>
            ) : (
              <div className="max-h-[75vh] space-y-4 overflow-auto p-5">
                <div className="rounded border border-[#c7a24e] bg-[#ead7a2] px-3 py-2 text-sm text-[#6f4f13]">
                  {describeActivity(actionDetail.data?.data)}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">What</div>
                    <div className="font-medium">{actionLabel(actionDetail.data?.data?.action)}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">Entity</div>
                    <div className="font-medium">{actionDetail.data?.data?.entity ?? "-"}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">Target</div>
                    <div className="font-medium">{targetLabel(actionDetail.data?.data)}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">When</div>
                    <div className="font-medium">{formatDateTime(actionDetail.data?.data?.createdAt)}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">Actor</div>
                    <div className="font-medium">{actorLabel(actionDetail.data?.data)}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm">
                    <div className="text-xs text-[var(--color-muted)]">Entity ID</div>
                    <div className="break-all font-medium">{actionDetail.data?.data?.entityId ?? "-"}</div>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[#efe6d0] p-3 text-sm md:col-span-2">
                    <div className="text-xs text-[var(--color-muted)]">Request ID</div>
                    <div className="break-all font-medium">{actionDetail.data?.data?.requestId ?? "-"}</div>
                  </div>
                </div>

                {actionDiffs.length ? (
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
                          {actionDiffs.map((diff) => (
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

                {requestId ? (
                  <section className="rounded border border-[var(--color-border)]">
                    <div className="border-b border-[var(--color-border)] bg-[#efe6d0] px-3 py-2 text-sm font-semibold">Request Timeline</div>
                    <div className="max-h-64 overflow-auto p-3">
                      {(timeline.data?.data ?? []).map((item: any) => (
                        <div key={item.id} className="mb-2 rounded border border-[var(--color-border-soft)] bg-[#fbf6ea] p-2 text-xs last:mb-0">
                          <div className="font-medium">{actionLabel(item.action)}</div>
                          <div className="text-[var(--color-muted)]">{new Date(item.createdAt).toLocaleString("en-US")} • {item.user?.name ?? item.user?.email ?? "-"}</div>
                        </div>
                      ))}
                      {timeline.isLoading ? <div className="text-xs text-[var(--color-muted)]">Loading timeline...</div> : null}
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
                      <pre className="max-h-72 overflow-auto p-3 text-xs">{renderJson(actionDetail.data?.data?.before)}</pre>
                    </section>
                    <section className="rounded border border-[var(--color-border)]">
                      <div className="border-b border-[var(--color-border)] bg-[#efe6d0] px-3 py-2 text-sm font-semibold">After</div>
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
