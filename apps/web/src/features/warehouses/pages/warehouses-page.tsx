import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../../lib/api-client";
import { Button, Card, Input } from "../../../components/ui/basic";
import { useAuth } from "../../auth/auth-context";

type Warehouse = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  isActive: boolean;
};

export const WarehousesPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "", isActive: true });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canManage = ["ADMIN", "MANAGER"].includes(user?.role ?? "");
  const canDelete = user?.role === "ADMIN";

  const q = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api<{ data: Warehouse[] }>("/warehouses"),
  });

  const createMutation = useMutation({
    mutationFn: () => api("/warehouses", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: async () => {
      setMessage(t("pages.warehouses.messages.created"));
      setError("");
      setForm({ name: "", code: "", address: "", isActive: true });
      await qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api(`/warehouses/${editing?.id}`, { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: async () => {
      setMessage(t("pages.warehouses.messages.updated"));
      setError("");
      setEditing(null);
      setForm({ name: "", code: "", address: "", isActive: true });
      await qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/warehouses/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setMessage(t("pages.warehouses.messages.deleted"));
      setError("");
      await qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const rows = useMemo(() => {
    const items = q.data?.data ?? [];
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter((item) => [item.name, item.code, item.address ?? ""].join(" ").toLowerCase().includes(term));
  }, [q.data?.data, search]);

  const submit = () => {
    if (!canManage) {
      setError(t("pages.warehouses.messages.noPermission"));
      return;
    }
    if (!form.name.trim() || !form.code.trim()) {
      setError(t("pages.warehouses.messages.nameCodeRequired"));
      return;
    }
    setError("");
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  };

  const startEdit = (warehouse: Warehouse) => {
    setEditing(warehouse);
    setForm({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address ?? "",
      isActive: warehouse.isActive,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        {canManage ? (
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_1.2fr_auto_auto]">
            <Input placeholder="Warehouse name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Input placeholder="Address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <label className="field-warm inline-flex h-11 items-center gap-2 rounded border px-3 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
            <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>{editing ? "Update" : "Create"}</Button>
          </div>
        ) : (
          <p className="text-sm text-[#6d5935]">You have read-only access to warehouses.</p>
        )}
        {editing && canManage ? (
          <div className="mt-2">
            <Button className="btn-muted-warm h-9 px-3 text-xs" onClick={() => { setEditing(null); setForm({ name: "", code: "", address: "", isActive: true }); }}>
              Cancel Edit
            </Button>
          </div>
        ) : null}
        {message ? <p className="mt-2 text-sm text-[#315f3d]">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-[#9c4326]">{error}</p> : null}
      </Card>

      <Card>
        <div className="mb-3">
          <Input placeholder="Search warehouse..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-auto">
          <table className="table-warm w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Address</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr><td className="px-3 py-6 text-center text-muted-warm" colSpan={5}>Loading warehouses...</td></tr>
              ) : null}
              {q.isError ? (
                <tr><td className="px-3 py-6 text-center text-[#9c4326]" colSpan={5}>{(q.error as Error).message}</td></tr>
              ) : null}
              {rows.map((warehouse) => (
                <tr key={warehouse.id}>
                  <td className="px-3 py-2">{warehouse.name}</td>
                  <td className="px-3 py-2">{warehouse.code}</td>
                  <td className="px-3 py-2">{warehouse.address || "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${warehouse.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                      {warehouse.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canManage ? (
                      <div className="flex justify-end gap-2">
                        <Button className="h-9 px-3" onClick={() => startEdit(warehouse)}>Edit</Button>
                        <Button className="btn-danger-warm h-9 px-3" onClick={() => deleteMutation.mutate(warehouse.id)} disabled={deleteMutation.isPending || !canDelete}>Delete</Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-warm">Read only</span>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && !q.isLoading && !q.isError ? (
                <tr><td className="px-3 py-6 text-center text-muted-warm" colSpan={5}>No warehouses found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
