import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { Button, Card, Input } from "../../../components/ui/basic";

type CategoryRow = {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  _count?: { products: number; children: number };
};

export const CategoriesPage = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [parentId, setParentId] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const q = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ data: CategoryRow[] }>("/categories"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string; isActive?: boolean; parentId?: string | null }) =>
      api("/categories", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      setMessage("Category created");
      setError("");
      setName("");
      setDescription("");
      setIsActive(true);
      setParentId("");
      await qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; description?: string; isActive?: boolean; parentId?: string | null }) =>
      api(`/categories/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: payload.name, description: payload.description, isActive: payload.isActive, parentId: payload.parentId }),
      }),
    onSuccess: async () => {
      setMessage("Category updated");
      setError("");
      setName("");
      setDescription("");
      setIsActive(true);
      setParentId("");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setMessage("Category deleted");
      setError("");
      await qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const visibilityMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      api(`/categories/${payload.id}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: payload.isActive }),
      }),
    onSuccess: async () => {
      setMessage("Category visibility updated");
      setError("");
      await qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const rows = useMemo(() => {
    const data = q.data?.data ?? [];
    if (!search.trim()) return data;
    return data.filter((c) =>
      [c.name, c.description ?? ""].join(" ").toLowerCase().includes(search.toLowerCase()),
    );
  }, [q.data?.data, search]);

  const submit = () => {
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, name: name.trim(), description: description.trim() || undefined, isActive, parentId: parentId || null });
      return;
    }
    createMutation.mutate({ name: name.trim(), description: description.trim() || undefined, isActive, parentId: parentId || null });
  };

  const startEdit = (row: CategoryRow) => {
    setEditing(row);
    setName(row.name);
    setDescription(row.description ?? "");
    setIsActive(row.isActive ?? true);
    setParentId(row.parentId ?? "");
    setError("");
    setMessage("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setParentId("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-2 md:grid-cols-[1.1fr_1fr_1fr_auto_auto]">
          <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">No parent (root)</option>
            {(q.data?.data ?? []).filter((c) => !editing || c.id !== editing.id).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="field-warm inline-flex h-11 items-center gap-2 rounded border px-3 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>
            {editing ? "Update" : "Add"}
          </Button>
          {editing ? (
            <Button className="btn-muted-warm" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
        </div>
        {message ? <p className="mt-2 text-sm text-[#315f3d]">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-[#9c4326]">{error}</p> : null}
      </Card>

      <Card>
        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <Input
            placeholder="Search category by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="self-center text-xs text-muted-warm">
            Total: {rows.length}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="table-warm w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Description</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Parent</th>
                <th className="text-left py-2">Products</th>
                <th className="text-left py-2">Children</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="text-[#6d5935]">{c.description || "-"}</td>
                  <td>
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${c.isActive !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                      {c.isActive !== false ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="text-[#6d5935]">{c.parent?.name ?? "-"}</td>
                  <td>{c._count?.products ?? 0}</td>
                  <td>{c._count?.children ?? 0}</td>
                  <td>
                    <div className="flex gap-2">
                      <Button className="h-9 px-3" onClick={() => startEdit(c)}>
                        Edit
                      </Button>
                      <Button
                        className="btn-danger-warm h-9 px-3"
                        onClick={() => deleteMutation.mutate(c.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                      <Button
                        className={`h-9 px-3 ${c.isActive !== false ? "btn-muted-warm" : ""}`}
                        onClick={() => visibilityMutation.mutate({ id: c.id, isActive: !(c.isActive !== false) })}
                        disabled={visibilityMutation.isPending}
                      >
                        {c.isActive !== false ? "Hide" : "Show"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="py-6 text-muted-warm" colSpan={7}>
                    No categories found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
