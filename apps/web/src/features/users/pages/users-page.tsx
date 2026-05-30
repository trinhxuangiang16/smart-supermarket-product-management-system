import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, KeyRound, Trash2, X } from "lucide-react";
import { api } from "../../../lib/api-client";
import { useAuth } from "../../auth/auth-context";
import { Button, Card, Input } from "../../../components/ui/basic";

const roleOptions = [
  "ADMIN",
  "MANAGER",
  "WAREHOUSE_STAFF",
  "CASHIER",
  "SALE_DEPARTMENT",
  "FINANCE_DEPARTMENT",
] as const;

const statusBadgeClass = (isActive: boolean) => (
  isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
);

export const UsersPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    role: "WAREHOUSE_STAFF",
    password: "Password123!",
  });

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "WAREHOUSE_STAFF",
    isActive: true,
  });

  const [passwordModal, setPasswordModal] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("Password123!");
  const [confirmModal, setConfirmModal] = useState<{
    action: "create" | "update" | "reset_password" | "delete";
    user?: any;
  } | null>(null);

  const canManageUsers = user?.role === "ADMIN";
  const canDeleteUsers = user?.role === "ADMIN";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (activeFilter) params.set("isActive", activeFilter);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortBy", "createdAt");
    params.set("sortOrder", "desc");
    return params.toString();
  }, [debouncedSearch, roleFilter, activeFilter, page, pageSize]);

  const usersQuery = useQuery({
    queryKey: ["users", queryString],
    queryFn: () => api<any>(`/users?${queryString}`),
    enabled: canManageUsers,
  });

  const createMutation = useMutation({
    mutationFn: () => api<any>("/users", { method: "POST", body: JSON.stringify(createForm) }),
    onSuccess: async () => {
      setMessage("User created");
      setError("");
      setCreateForm({ ...createForm, name: "", email: "", password: "Password123!" });
      await qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api<any>(`/users/${editingUser.id}`, { method: "PUT", body: JSON.stringify(editForm) }),
    onSuccess: async () => {
      setMessage("User updated");
      setError("");
      setEditingUser(null);
      await qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => api<any>(`/users/${passwordModal.id}/password`, { method: "PATCH", body: JSON.stringify({ password: newPassword }) }),
    onSuccess: async () => {
      setMessage("Password reset");
      setError("");
      setPasswordModal(null);
      setNewPassword("Password123!");
      await qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<any>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setMessage("User deleted");
      setError("");
      await qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const runConfirmedAction = () => {
    if (!confirmModal) return;
    if (confirmModal.action === "create") {
      createMutation.mutate();
      setConfirmModal(null);
      return;
    }
    if (confirmModal.action === "update") {
      updateMutation.mutate();
      setConfirmModal(null);
      return;
    }
    if (confirmModal.action === "reset_password") {
      resetPasswordMutation.mutate();
      setConfirmModal(null);
      return;
    }
    if (confirmModal.action === "delete" && confirmModal.user?.id) {
      deleteMutation.mutate(confirmModal.user.id);
      setConfirmModal(null);
    }
  };

  if (!canManageUsers) {
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-sm text-slate-600">
            You do not have permission to manage users.
          </p>
        </Card>
      </div>
    );
  }

  const rows = usersQuery.data?.data?.items ?? [];
  const total = usersQuery.data?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const queryError = usersQuery.error as Error | null;

  const allowedRolesForCreate = user?.role === "ADMIN"
    ? roleOptions
    : roleOptions.filter((r) => r !== "ADMIN");

  const allowedRolesForEdit = user?.role === "ADMIN"
    ? roleOptions
    : roleOptions.filter((r) => r !== "ADMIN");

  return (
    <div className="space-y-4">
      {message ? <Card><p className="text-sm text-emerald-700">{message}</p></Card> : null}
      {error ? <Card><p className="text-sm text-red-600">{error}</p></Card> : null}
      {queryError ? <Card><p className="text-sm text-red-600">{queryError.message}</p></Card> : null}

      <Card>
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Search by name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="h-11 rounded border px-3 text-sm" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">All roles</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select className="h-11 rounded border px-3 text-sm" value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select className="h-11 rounded border px-3 text-sm" value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value="10">10 / page</option>
            <option value="20">20 / page</option>
            <option value="50">50 / page</option>
          </select>
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-semibold">Create User</div>
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Full name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
          <Input placeholder="Email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          <select className="h-11 rounded border px-3 text-sm" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
            {allowedRolesForCreate.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <Input type="password" placeholder="Password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
        </div>
        <div className="mt-3">
          <Button
            onClick={() => setConfirmModal({ action: "create" })}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create User"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-auto">
          <table className="w-full min-w-[980px] table-fixed text-sm">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-left font-semibold">Email</th>
                <th className="px-3 py-2 text-left font-semibold">Role</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Created</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading users...</td></tr>
              ) : null}
              {!usersQuery.isLoading && !rows.length ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No users found.</td></tr>
              ) : null}
              {rows.map((u: any) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="truncate px-3 py-2" title={u.name}>{u.name}</td>
                  <td className="truncate px-3 py-2" title={u.email}>{u.email}</td>
                  <td className="px-3 py-2">{u.role}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${statusBadgeClass(Boolean(u.isActive))}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{new Date(u.createdAt).toLocaleDateString("en-US")}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        className="inline-flex h-9 items-center gap-1 rounded border px-3 text-xs hover:bg-slate-50"
                        onClick={() => {
                          setEditingUser(u);
                          setEditForm({ name: u.name, role: u.role, isActive: Boolean(u.isActive) });
                        }}
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                      <button
                        className="inline-flex h-9 items-center gap-1 rounded border px-3 text-xs hover:bg-slate-50"
                        onClick={() => {
                          setPasswordModal(u);
                          setNewPassword("Password123!");
                        }}
                      >
                        <KeyRound size={13} /> Password
                      </button>
                      {canDeleteUsers ? (
                        <button
                          className="inline-flex h-9 items-center gap-1 rounded border border-red-200 bg-red-50 px-3 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                          disabled={u.id === user?.id || deleteMutation.isPending}
                          title={u.id === user?.id ? "You cannot delete your own account" : "Delete user"}
                          onClick={() => setConfirmModal({ action: "delete", user: u })}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-500">Total users: {total}</span>
          <div className="flex items-center gap-2">
            <button className="h-9 rounded border px-3 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <span>Page {page} / {totalPages}</span>
            <button className="h-9 rounded border px-3 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          </div>
        </div>
      </Card>

      {editingUser ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-md border bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Edit User</h2>
                <p className="text-sm text-slate-500">{editingUser.email}</p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded border text-slate-600 hover:bg-slate-50" onClick={() => setEditingUser(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              <select className="h-11 w-full rounded border px-3 text-sm" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                {allowedRolesForEdit.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Active account
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <button className="h-11 rounded border bg-white px-4 text-sm" onClick={() => setEditingUser(null)}>Cancel</button>
              <Button onClick={() => setConfirmModal({ action: "update", user: editingUser })} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordModal ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-md border bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Reset Password</h2>
                <p className="text-sm text-slate-500">{passwordModal.email}</p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded border text-slate-600 hover:bg-slate-50" onClick={() => setPasswordModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <p className="text-xs text-slate-500">Minimum 8 characters.</p>
            </div>
            <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <button className="h-11 rounded border bg-white px-4 text-sm" onClick={() => setPasswordModal(null)}>Cancel</button>
              <Button
                onClick={() => setConfirmModal({ action: "reset_password", user: passwordModal })}
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? "Updating..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-md border bg-white shadow-2xl">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Confirm Action</h2>
              <p className="mt-1 text-sm text-slate-600">
                {confirmModal.action === "create" ? "Create this new user account?" : null}
                {confirmModal.action === "update" ? `Save changes for ${confirmModal.user?.email}?` : null}
                {confirmModal.action === "reset_password" ? `Reset password for ${confirmModal.user?.email}?` : null}
                {confirmModal.action === "delete" ? `Delete user ${confirmModal.user?.email}? This cannot be undone.` : null}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <button className="h-11 rounded border bg-white px-4 text-sm" onClick={() => setConfirmModal(null)}>Cancel</button>
              <Button
                className={confirmModal.action === "delete" ? "bg-red-700 hover:bg-red-600" : ""}
                onClick={runConfirmedAction}
                disabled={createMutation.isPending || updateMutation.isPending || resetPasswordMutation.isPending || deleteMutation.isPending}
              >
                {confirmModal.action === "delete" ? "Delete" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
