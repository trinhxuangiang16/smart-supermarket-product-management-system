import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../../../lib/api-client";
import { useAuth } from "../../auth/auth-context";
import { Button, Card, Input } from "../../../components/ui/basic";

type SupplierRow = {
  id: string;
  name: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  notes?: string | null;
  createdAt?: string;
  _count?: { products: number };
};

export const SuppliersPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = ["ADMIN", "MANAGER"].includes(user?.role ?? "");
  const canDelete = user?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    contactPerson: "",
    notes: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api<{ data: SupplierRow[] }>("/suppliers"),
  });

  const createMutation = useMutation({
    mutationFn: () => api<any>("/suppliers", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: async () => {
      setMessage("Supplier created.");
      setError("");
      setForm({ name: "", contactEmail: "", contactPhone: "", address: "", contactPerson: "", notes: "" });
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api<any>(`/suppliers/${editing?.id}`, { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: async () => {
      setMessage("Supplier updated.");
      setError("");
      setEditing(null);
      setForm({ name: "", contactEmail: "", contactPhone: "", address: "", contactPerson: "", notes: "" });
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<any>(`/suppliers/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setMessage("Supplier deleted.");
      setError("");
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const rows = useMemo(() => {
    const items = suppliersQuery.data?.data ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((s) => [s.name, s.contactEmail ?? "", s.contactPhone ?? "", s.address ?? "", s.contactPerson ?? "", s.notes ?? ""].join(" ").toLowerCase().includes(q));
  }, [suppliersQuery.data?.data, search]);

  const submit = () => {
    if (!canManage) {
      setError("Only admin/manager can create or edit suppliers.");
      return;
    }
    if (!form.name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setError("");
    if (editing) {
      updateMutation.mutate();
      return;
    }
    createMutation.mutate();
  };

  const startEdit = (row: SupplierRow) => {
    setEditing(row);
    setForm({
      name: row.name ?? "",
      contactEmail: row.contactEmail ?? "",
      contactPhone: row.contactPhone ?? "",
      address: row.address ?? "",
      contactPerson: row.contactPerson ?? "",
      notes: row.notes ?? "",
    });
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: "", contactEmail: "", contactPhone: "", address: "", contactPerson: "", notes: "" });
  };

  const queryError = suppliersQuery.error as Error | null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {message ? <Card><p className="text-sm text-emerald-700">{message}</p></Card> : null}
      {error ? <Card><p className="text-sm text-red-600">{error}</p></Card> : null}
      {queryError ? <Card><p className="text-sm text-red-600">{queryError.message}</p></Card> : null}

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold">{editing ? "Edit Supplier" : "Create Supplier"}</div>
          {!canManage ? <span className="text-xs text-slate-500">Read-only for this role</span> : null}
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <Input
            placeholder="Supplier name"
            value={form.name}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Contact email"
            value={form.contactEmail}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
          <Input
            placeholder="Contact phone"
            value={form.contactPhone}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          />
          <Input
            placeholder="Address"
            value={form.address}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            placeholder="Contact person"
            value={form.contactPerson}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
          />
          <Input
            placeholder="Notes"
            value={form.notes}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={submit} disabled={!canManage || isSubmitting}>
            {editing ? (isSubmitting ? "Saving..." : "Save Changes") : (isSubmitting ? "Creating..." : "Create Supplier")}
          </Button>
          {editing ? (
            <Button className="bg-slate-500" onClick={cancelEdit} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <Input
            placeholder="Search supplier by name, email, phone, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="self-center text-xs text-slate-500">Total: {rows.length}</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1280px] table-fixed text-sm">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-left font-semibold">Email</th>
                <th className="px-3 py-2 text-left font-semibold">Phone</th>
                <th className="px-3 py-2 text-left font-semibold">Address</th>
                <th className="px-3 py-2 text-left font-semibold">Contact Person / Notes</th>
                <th className="px-3 py-2 text-center font-semibold">Products</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliersQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Loading suppliers...</td>
                </tr>
              ) : null}
              {!suppliersQuery.isLoading && !rows.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">No suppliers found.</td>
                </tr>
              ) : null}
              {rows.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="truncate px-3 py-2" title={s.name}>{s.name}</td>
                  <td className="truncate px-3 py-2" title={s.contactEmail ?? "-"}>{s.contactEmail ?? "-"}</td>
                  <td className="truncate px-3 py-2" title={s.contactPhone ?? "-"}>{s.contactPhone ?? "-"}</td>
                  <td className="truncate px-3 py-2" title={s.address ?? "-"}>{s.address ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="truncate font-medium" title={s.contactPerson ?? "-"}>{s.contactPerson ?? "-"}</div>
                    <div className="truncate text-xs text-slate-500" title={s.notes ?? "-"}>{s.notes ?? "-"}</div>
                  </td>
                  <td className="px-3 py-2 text-center">{s._count?.products ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      {canManage ? (
                        <button
                          className="inline-flex h-9 items-center gap-1 rounded border px-3 text-xs hover:bg-slate-50"
                          onClick={() => startEdit(s)}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          className="inline-flex h-9 items-center gap-1 rounded border border-red-200 bg-red-50 px-3 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (!window.confirm(`Delete supplier ${s.name}?`)) return;
                            deleteMutation.mutate(s.id);
                          }}
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
      </Card>
    </div>
  );
};
