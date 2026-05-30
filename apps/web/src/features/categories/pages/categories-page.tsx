import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { Button, Card, Input } from "../../../components/ui/basic";

type CategoryRow = {
  id: string;
  name: string;
  description?: string | null;
  _count?: { products: number };
};

export const CategoriesPage = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const q = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ data: CategoryRow[] }>("/categories"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      api("/categories", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      setMessage("Category created");
      setError("");
      setName("");
      setDescription("");
      await qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; description?: string }) =>
      api(`/categories/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: payload.name, description: payload.description }),
      }),
    onSuccess: async () => {
      setMessage("Category updated");
      setError("");
      setName("");
      setDescription("");
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
      updateMutation.mutate({ id: editing.id, name: name.trim(), description: description.trim() || undefined });
      return;
    }
    createMutation.mutate({ name: name.trim(), description: description.trim() || undefined });
  };

  const startEdit = (row: CategoryRow) => {
    setEditing(row);
    setName(row.name);
    setDescription(row.description ?? "");
    setError("");
    setMessage("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setName("");
    setDescription("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_auto_auto]">
          <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>
            {editing ? "Update" : "Add"}
          </Button>
          {editing ? (
            <Button className="bg-slate-500" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
        </div>
        {message ? <p className="mt-2 text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </Card>

      <Card>
        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <Input
            placeholder="Search category by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="text-xs text-slate-500 self-center">
            Total: {rows.length}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Description</th>
                <th className="text-left py-2">Products</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 text-slate-600">{c.description || "-"}</td>
                  <td className="py-2">{c._count?.products ?? 0}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <Button className="h-9 px-3" onClick={() => startEdit(c)}>
                        Edit
                      </Button>
                      <Button
                        className="h-9 px-3 bg-red-600"
                        onClick={() => deleteMutation.mutate(c.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="py-6 text-slate-500" colSpan={4}>
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
