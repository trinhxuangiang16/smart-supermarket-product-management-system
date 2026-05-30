import { Bell, CheckCircle2, ChevronDown, CircleUserRound, Search, X, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/auth-context";
import { api } from "../../lib/api-client";
const nav = [
  ["Dashboard", "/"], ["Products", "/products"], ["Inventory", "/inventory"], ["Suppliers", "/suppliers"],
  ["Categories", "/categories"], ["Warehouses", "/warehouses"], ["Expiry Alerts", "/expiry"], ["Reports", "/reports"], ["Audit History", "/audit"], ["Users", "/users"], ["Automation", "/automation"], ["Settings", "/settings"],
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
  const branchName = systemSettings.data?.data?.profile?.branchName ?? "Main Branch";
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
    <div className="h-screen grid md:grid-cols-[220px_1fr] bg-slate-100">
      <aside className="border-r bg-white p-3 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="text-lg font-semibold">{storeName}</div>
          <div className="text-xs text-slate-500">{branchName}</div>
        </div>
        <div className="mt-2 space-y-1">
          {visibleNav.map(([label, to]) => <Link key={to} className={`block rounded px-3 py-2 text-sm ${pathname === to ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`} to={to}>{label}</Link>)}
        </div>
      </aside>
      <main className="overflow-y-auto">
        <header className="sticky top-0 z-20 bg-white/95 border-b px-5 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Operations</div>
            <div className="font-semibold">{pageTitle}</div>
          </div>
          <div className="flex items-center gap-3">
            <button className="h-10 px-3 rounded border text-sm text-slate-600 inline-flex items-center gap-2">
              <Search size={16} />
              Search
            </button>
            {canReviewApprovals ? (
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen((v) => !v)}
                  className={`relative grid h-10 w-10 place-items-center rounded border text-slate-600 transition ${Number(pendingCount.data?.data?.count ?? 0) > 0 ? "border-amber-300 bg-amber-50 text-amber-700" : "hover:bg-slate-50"}`}
                  aria-label="Approval notifications"
                >
                  <Bell size={16} className={Number(pendingCount.data?.data?.count ?? 0) > 0 ? "animate-pulse" : ""} />
                  {Number(pendingCount.data?.data?.count ?? 0) > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {pendingCount.data?.data?.count}
                    </span>
                  ) : null}
                </button>
                {notificationsOpen ? (
                  <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-md border bg-white shadow-xl">
                    <div className="border-b px-4 py-3">
                      <div className="text-sm font-semibold">Approval requests</div>
                      <div className="text-xs text-slate-500">Product updates and delete requests waiting for review.</div>
                    </div>
                    <div className="max-h-96 overflow-auto p-2">
                      {pendingApprovals.isLoading ? <div className="px-3 py-4 text-sm text-slate-500">Loading requests...</div> : null}
                      {(pendingApprovals.data?.data ?? []).length === 0 && !pendingApprovals.isLoading ? (
                        <div className="px-3 py-4 text-sm text-slate-500">No pending approval requests.</div>
                      ) : null}
                      {(pendingApprovals.data?.data ?? []).map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => { setSelectedApproval(item); setReviewNote(""); }}
                          className="w-full rounded px-3 py-3 text-left hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className={`rounded px-2 py-1 text-xs font-medium ${item.type === "PRODUCT_DELETE" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                              {item.type === "PRODUCT_DELETE" ? "Delete" : "Edit"}
                            </span>
                            <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-US")}</span>
                          </div>
                          <div className="mt-2 text-sm font-medium text-slate-900">{item.product?.name}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {item.requestedBy?.name} requests {item.type === "PRODUCT_DELETE" ? "deletion" : "changes"}: {item.reason}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            Next required role: <span className="font-medium text-slate-700">{item.nextRequiredRole ?? "-"}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="h-10 pl-2 pr-3 rounded border inline-flex items-center gap-2">
                <CircleUserRound size={18} />
                <div className="text-left leading-tight">
                  <div className="text-xs text-slate-500">{user?.role}</div>
                  <div className="text-sm">{user?.name ?? user?.email}</div>
                </div>
                <ChevronDown size={14} />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-52 rounded-md border bg-white shadow-lg p-1">
                  <div className="px-3 py-2 border-b">
                    <div className="text-sm font-medium">{user?.name}</div>
                    <div className="text-xs text-slate-500">{user?.email}</div>
                  </div>
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded">
                    Profile
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 rounded"
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-md border bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${selectedApproval.type === "PRODUCT_DELETE" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                    {selectedApproval.type === "PRODUCT_DELETE" ? "Delete request" : "Edit request"}
                  </span>
                  <h2 className="text-lg font-semibold">Approval Detail</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Requested by {selectedApproval.requestedBy?.name ?? selectedApproval.requestedBy?.email}
                </p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded border text-slate-600 hover:bg-slate-50" onClick={() => setSelectedApproval(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-md border p-4">
                  <h3 className="text-sm font-semibold">Product</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><span className="text-slate-500">Name</span><span className="font-medium text-right">{selectedApproval.product?.name}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-slate-500">SKU</span><span className="font-medium text-right">{selectedApproval.product?.sku}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-slate-500">Current stock</span><span className="font-medium text-right">{selectedApproval.product?.currentStock}</span></div>
                  </div>
                </section>
                <section className="rounded-md border p-4">
                  <h3 className="text-sm font-semibold">Reason</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{selectedApproval.reason}</p>
                </section>
              </div>

              {selectedApproval.type === "PRODUCT_UPDATE" ? (
                <section className="mt-4 rounded-md border">
                  <div className="border-b px-4 py-3 text-sm font-semibold">Requested changes</div>
                  <div className="divide-y">
                    {Object.entries(selectedApproval.requestedChanges ?? {}).filter(([key]) => key !== "__workflow").map(([key, value]) => (
                      <div key={key} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[160px_1fr_1fr]">
                        <div className="font-medium text-slate-700">{key}</div>
                        <div><span className="text-xs text-slate-500">Current</span><div className="break-words">{String(selectedApproval.before?.[key] ?? "-")}</div></div>
                        <div><span className="text-xs text-slate-500">Requested</span><div className="break-words font-medium">{String(value ?? "-")}</div></div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  This request will remove the product from active product management. Transaction history will be kept for audit safety.
                </section>
              )}
              <section className="mt-4 rounded-md border bg-slate-50 p-4 text-sm">
                <div className="text-xs text-slate-500">Approval workflow</div>
                <div className="mt-1">
                  Required roles: {(readWorkflow(selectedApproval.requestedChanges).requiredRoles ?? []).join(" -> ") || "-"}
                </div>
                <div className="mt-1">
                  Approved steps: {(readWorkflow(selectedApproval.requestedChanges).approvedBy ?? []).length}
                </div>
              </section>
              <section className="mt-4 rounded-md border p-4">
                <div className="text-sm font-medium">Review Note</div>
                <textarea
                  className="mt-2 min-h-24 w-full rounded border px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="Add note for approve/reject action..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">Reject requires note with at least 3 characters.</p>
              </section>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              {reviewMutation.error ? <div className="mr-auto text-sm text-red-600">{(reviewMutation.error as Error).message}</div> : null}
              <button
                className="inline-flex h-11 items-center gap-2 rounded border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ id: selectedApproval.id, action: "reject", reviewNote })}
              >
                <XCircle size={16} /> Reject
              </button>
              <button
                className="inline-flex h-11 items-center gap-2 rounded bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
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
