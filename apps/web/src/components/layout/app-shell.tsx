import { Bell, CheckCircle2, ChevronDown, CircleUserRound, Search, Store, X, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/auth-context";
import { api } from "../../lib/api-client";
const nav = [
  ["Dashboard", "/"], ["Products", "/products"], ["Inventory", "/inventory"], ["Suppliers", "/suppliers"],
  ["Categories", "/categories"], ["Warehouses", "/warehouses"], ["Assets", "/assets"], ["Employees", "/employees"], ["Expiry Alerts", "/expiry"], ["Reports", "/reports"], ["Audit History", "/audit"], ["Users", "/users"], ["Automation", "/automation"], ["Settings", "/settings"],
];

const readWorkflow = (requestedChanges: any) => requestedChanges?.__workflow ?? { requiredRoles: [], approvedBy: [] };
export const AppShell = () => {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const canReviewApprovals = ["ADMIN", "MANAGER"].includes(user?.role ?? "");
  const systemSettings = useQuery({
    queryKey: ["settings-system"],
    queryFn: () => api<any>("/settings/system"),
    staleTime: 300000,
  });
  const approvalRefetchMs = Math.max(
    2000,
    Number(systemSettings.data?.data?.operations?.approvalBellRefreshSeconds ?? 5) * 1000,
  );
  const storeName = systemSettings.data?.data?.profile?.storeName ?? "Smart Supermarket";
  const pendingCount = useQuery({
    queryKey: ["approval-pending-count"],
    queryFn: () => api<any>("/approvals/pending-count"),
    enabled: canReviewApprovals,
    refetchInterval: canReviewApprovals ? approvalRefetchMs : false,
  });
  const pendingApprovals = useQuery({
    queryKey: ["approval-pending-list"],
    queryFn: () => api<any>("/approvals/pending"),
    enabled: canReviewApprovals && notificationsOpen,
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, action, reviewNote: note }: { id: string; action: "approve" | "reject"; reviewNote?: string }) =>
      api(`/approvals/${id}/${action}`, { method: "POST", body: JSON.stringify({ reviewNote: note }) }),
    onSuccess: async () => {
      setSelectedApproval(null);
      setReviewNote("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["approval-pending-count"] }),
        qc.invalidateQueries({ queryKey: ["approval-pending-list"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["recent"] }),
        qc.invalidateQueries({ queryKey: ["kpi"] }),
      ]);
    },
  });
  const visibleNav = useMemo(() => {
    const role = user?.role ?? "";
    if (["SALE_DEPARTMENT", "FINANCE_DEPARTMENT"].includes(role)) {
      return [
        ["Reports", "/reports"],
        ["Audit History", "/audit"],
        ["Settings", "/settings"],
      ] as Array<[string, string]>;
    }
    if (role === "CASHIER") {
      return [
        ["Dashboard", "/"],
        ["Products", "/products"],
        ["Inventory", "/inventory"],
        ["Reports", "/reports"],
        ["Audit History", "/audit"],
        ["Settings", "/settings"],
      ] as Array<[string, string]>;
    }
    if (role === "WAREHOUSE_STAFF") {
      return [
        ["Dashboard", "/"],
        ["Products", "/products"],
        ["Inventory", "/inventory"],
        ["Suppliers", "/suppliers"],
        ["Categories", "/categories"],
        ["Warehouses", "/warehouses"],
        ["Assets", "/assets"],
        ["Expiry Alerts", "/expiry"],
        ["Reports", "/reports"],
        ["Audit History", "/audit"],
        ["Settings", "/settings"],
      ] as Array<[string, string]>;
    }
    if (role === "MANAGER") {
      return nav.filter((n) => n[0] !== "Users") as Array<[string, string]>;
    }
    return nav;
  }, [user?.role]);
  const pageTitle = useMemo(() => visibleNav.find((x) => x[1] === pathname)?.[0] ?? "Dashboard", [pathname, visibleNav]);
  return (
    <div className="grid h-screen bg-[var(--color-page)] md:grid-cols-[220px_1fr]">
      <aside className="overflow-y-auto border-r border-[#183a24] bg-[linear-gradient(180deg,var(--color-sidebar)_0%,var(--color-sidebar-deep)_100%)] p-3 text-[var(--color-sidebar-text)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_rgba(8,27,15,0.22)]">
          <div className="flex items-center gap-3">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#e6c46f_0%,#86ad86_52%,#315f3d_100%)] text-[#fff9ee] shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
              <Store size={22} strokeWidth={2.2} />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#20462d] bg-[#e6c46f]" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold leading-tight tracking-tight text-[#fff9ee]">{storeName}</div>
              <div className="mt-1 inline-flex rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#dfead7]">
                Management System
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {visibleNav.map(([label, to]) => <Link key={to} className={`block rounded px-3 py-2 text-sm transition ${pathname === to ? "bg-[var(--color-sidebar-active)] text-white shadow-sm" : "text-[#e8eddc] hover:bg-white/10"}`} to={to}>{label}</Link>)}
        </div>
      </aside>
      <main className="overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-app)]/95 px-5 py-3 backdrop-blur">
          <div>
            <div className="text-lg font-extrabold leading-tight tracking-tight text-[#15371f]">{pageTitle}</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#ead6aa] bg-[#fff9ee]/70 p-1 shadow-[0_8px_20px_rgba(72,54,25,0.08)]">
            <button className="inline-flex h-10 items-center gap-2 rounded-full border border-[#b7c5a3] bg-[#f4f6e9] px-4 text-sm font-semibold text-[#15371f] transition hover:border-[#8faa7d] hover:bg-[#e9f0dc]">
              <Search size={16} />
              Search
            </button>
            {canReviewApprovals ? (
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen((v) => !v)}
                  className={`relative grid h-10 w-10 place-items-center rounded-full border transition ${Number(pendingCount.data?.data?.count ?? 0) > 0 ? "border-[#c7a24e] bg-[#ead7a2] text-[#6f4f13] shadow-sm" : "border-[#ead6aa] bg-[#fffaf0] text-[#315f3d] hover:border-[#b7c5a3] hover:bg-[#f4f6e9]"}`}
                  aria-label="Approval notifications"
                >
                  <Bell size={16} className={Number(pendingCount.data?.data?.count ?? 0) > 0 ? "animate-pulse" : ""} />
                  {Number(pendingCount.data?.data?.count ?? 0) > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--color-coral)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {pendingCount.data?.data?.count}
                    </span>
                  ) : null}
                </button>
                {notificationsOpen ? (
                  <div className="surface-card absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-md border shadow-xl">
                    <div className="border-b border-[var(--color-border)] px-4 py-3">
                      <div className="text-sm font-semibold">Approval requests</div>
                      <div className="text-xs text-[var(--color-muted)]">Product updates and delete requests waiting for review.</div>
                    </div>
                    <div className="max-h-96 overflow-auto p-2">
                      {pendingApprovals.isLoading ? <div className="px-3 py-4 text-sm text-[var(--color-muted)]">Loading requests...</div> : null}
                      {(pendingApprovals.data?.data ?? []).length === 0 && !pendingApprovals.isLoading ? (
                        <div className="px-3 py-4 text-sm text-[var(--color-muted)]">No pending approval requests.</div>
                      ) : null}
                      {(pendingApprovals.data?.data ?? []).map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => { setSelectedApproval(item); setReviewNote(""); }}
                          className="w-full rounded px-3 py-3 text-left hover:bg-[#efe6d0]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className={`rounded px-2 py-1 text-xs font-medium ${item.type === "PRODUCT_DELETE" ? "bg-[#f0c7bd] text-[#8f2f20]" : "bg-[#ead7a2] text-[#6f4f13]"}`}>
                              {item.type === "PRODUCT_DELETE" ? "Delete" : "Edit"}
                            </span>
                            <span className="text-xs text-[var(--color-muted)]">{new Date(item.createdAt).toLocaleString("en-US")}</span>
                          </div>
                          <div className="mt-2 text-sm font-medium text-[var(--color-ink)]">{item.product?.name}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                            {item.requestedBy?.name} requests {item.type === "PRODUCT_DELETE" ? "deletion" : "changes"}: {item.reason}
                          </div>
                          <div className="mt-1 text-[11px] text-[var(--color-muted)]">
                            Next required role: <span className="font-medium text-[var(--color-sidebar)]">{item.nextRequiredRole ?? "-"}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ead6aa] bg-[#fffaf0] pl-1.5 pr-3 transition hover:border-[#b7c5a3] hover:bg-[#f4f6e9]">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e9f0dc] text-[#315f3d]">
                  <CircleUserRound size={17} />
                </span>
                <div className="text-left leading-tight">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[#8f7d5a]">{user?.role}</div>
                  <div className="max-w-[190px] truncate text-sm font-semibold text-[#2f2b20]">{user?.name ?? user?.email}</div>
                </div>
                <ChevronDown size={14} className="text-[#6d5935]" />
              </button>
              {menuOpen ? (
                <div className="surface-card absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-[#ead6aa] p-1 shadow-[0_18px_42px_rgba(72,54,25,0.18)]">
                  <div className="border-b border-[#ead6aa] bg-[#f7ebd5] px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e9f0dc] text-[#315f3d]">
                        <CircleUserRound size={19} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#2f2b20]">{user?.name}</div>
                        <div className="truncate text-xs text-muted-warm">{user?.email}</div>
                      </div>
                    </div>
                  </div>
                  <button className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#315f3d] hover:bg-[#e9f0dc]">
                    Profile
                  </button>
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#9b3f2e] hover:bg-[#f0c7bd]"
                    onClick={logout}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="p-4"><Outlet /></div>
      </main>
      {selectedApproval ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#15371f]/45 p-4">
          <div className="surface-card w-full max-w-3xl overflow-hidden rounded-md border shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${selectedApproval.type === "PRODUCT_DELETE" ? "bg-[#f0c7bd] text-[#8f2f20]" : "bg-[#ead7a2] text-[#6f4f13]"}`}>
                    {selectedApproval.type === "PRODUCT_DELETE" ? "Delete request" : "Edit request"}
                  </span>
                  <h2 className="text-lg font-semibold">Approval Detail</h2>
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Requested by {selectedApproval.requestedBy?.name ?? selectedApproval.requestedBy?.email}
                </p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded border border-[var(--color-border)] text-[var(--color-sidebar)] hover:bg-[#efe6d0]" onClick={() => setSelectedApproval(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-md border border-[var(--color-border)] bg-[#fbf6ea] p-4">
                  <h3 className="text-sm font-semibold">Product</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><span className="text-[var(--color-muted)]">Name</span><span className="text-right font-medium">{selectedApproval.product?.name}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-[var(--color-muted)]">SKU</span><span className="text-right font-medium">{selectedApproval.product?.sku}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-[var(--color-muted)]">Current stock</span><span className="text-right font-medium">{selectedApproval.product?.currentStock}</span></div>
                  </div>
                </section>
                <section className="rounded-md border border-[var(--color-border)] bg-[#fbf6ea] p-4">
                  <h3 className="text-sm font-semibold">Reason</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{selectedApproval.reason}</p>
                </section>
              </div>

              {selectedApproval.type === "PRODUCT_UPDATE" ? (
                <section className="mt-4 rounded-md border border-[var(--color-border)]">
                  <div className="border-b border-[var(--color-border)] bg-[#efe6d0] px-4 py-3 text-sm font-semibold">Requested changes</div>
                  <div className="divide-y">
                    {Object.entries(selectedApproval.requestedChanges ?? {}).filter(([key]) => key !== "__workflow").map(([key, value]) => (
                      <div key={key} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[160px_1fr_1fr]">
                        <div className="font-medium text-[var(--color-sidebar)]">{key}</div>
                        <div><span className="text-xs text-[var(--color-muted)]">Current</span><div className="break-words">{String(selectedApproval.before?.[key] ?? "-")}</div></div>
                        <div><span className="text-xs text-[var(--color-muted)]">Requested</span><div className="break-words font-medium">{String(value ?? "-")}</div></div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="mt-4 rounded-md border border-[#c87663] bg-[#f0c7bd] p-4 text-sm text-[#8f2f20]">
                  This request will remove the product from active product management. Transaction history will be kept for audit safety.
                </section>
              )}
              <section className="mt-4 rounded-md border border-[var(--color-border)] bg-[#efe6d0] p-4 text-sm">
                <div className="text-xs text-[var(--color-muted)]">Approval workflow</div>
                <div className="mt-1">
                  Required roles: {(readWorkflow(selectedApproval.requestedChanges).requiredRoles ?? []).join(" -> ") || "-"}
                </div>
                <div className="mt-1">
                  Approved steps: {(readWorkflow(selectedApproval.requestedChanges).approvedBy ?? []).length}
                </div>
              </section>
              <section className="mt-4 rounded-md border border-[var(--color-border)] p-4">
                <div className="text-sm font-medium">Review Note</div>
                <textarea
                  className="field-warm mt-2 min-h-24 w-full rounded border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25"
                  placeholder="Add note for approve/reject action..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
                <p className="mt-1 text-xs text-[var(--color-muted)]">Reject requires note with at least 3 characters.</p>
              </section>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] bg-[#efe6d0] px-5 py-4">
              {reviewMutation.error ? <div className="mr-auto text-sm text-[#9b3f2e]">{(reviewMutation.error as Error).message}</div> : null}
              <button
                className="inline-flex h-11 items-center gap-2 rounded border border-[#c87663] bg-[#f0c7bd] px-4 text-sm font-medium text-[#8f2f20] hover:bg-[#e6a998] disabled:opacity-40"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ id: selectedApproval.id, action: "reject", reviewNote })}
              >
                <XCircle size={16} /> Reject
              </button>
              <button
                className="btn-gold inline-flex h-11 items-center gap-2 rounded border px-4 text-sm font-medium disabled:opacity-40"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ id: selectedApproval.id, action: "approve", reviewNote })}
              >
                <CheckCircle2 size={16} /> Approve
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
