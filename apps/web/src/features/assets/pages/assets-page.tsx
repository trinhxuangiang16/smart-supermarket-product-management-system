import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../../../lib/api-client";
import { useAuth } from "../../auth/auth-context";
import { Button, Card, Input } from "../../../components/ui/basic";
import { useToast } from "../../../components/ui/toast";

const assetFormSchema = z.object({
  code: z.string().trim().min(2, "Code must be at least 2 characters"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  type: z.string().trim().min(2, "Type is required"),
  status: z.enum(["ACTIVE", "IN_REPAIR", "RETIRED", "LOST"]),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  cost: z.coerce.number().min(0, "Cost must be >= 0"),
  depreciationMonths: z.coerce.number().int().min(0).max(600),
  warehouseId: z.string().optional(),
  assignedUserId: z.string().optional(),
  notes: z.string().optional(),
});

type AssetForm = z.infer<typeof assetFormSchema>;

type AssetRow = AssetForm & {
  id: string;
  currentValue: number;
  monthlyDepreciation: number;
  monthsElapsed: number;
  warehouse?: { id: string; name: string } | null;
  assignedUser?: { id: string; name: string } | null;
};

const emptyForm: AssetForm = {
  code: "", name: "", type: "", status: "ACTIVE", purchaseDate: "",
  cost: 0, depreciationMonths: 0, warehouseId: "", assignedUserId: "", notes: "",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Active", IN_REPAIR: "In repair", RETIRED: "Retired", LOST: "Lost",
};

const statusBadge: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  IN_REPAIR: "bg-amber-100 text-amber-700",
  RETIRED: "bg-slate-200 text-slate-700",
  LOST: "bg-red-100 text-red-700",
};

const money = (n: number) => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export const AssetsPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { notify } = useToast();
  const canManage = ["ADMIN", "MANAGER"].includes(user?.role ?? "");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AssetRow | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AssetForm>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: emptyForm,
  });

  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search.trim()) params.set("search", search.trim());
  if (statusFilter) params.set("status", statusFilter);
  if (warehouseFilter) params.set("warehouseId", warehouseFilter);

  const assetsQuery = useQuery({
    queryKey: ["assets", page, search, statusFilter, warehouseFilter],
    queryFn: () => api<any>(`/assets?${params.toString()}`),
  });
  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api<any>("/warehouses"),
  });
  const usersQuery = useQuery({
    queryKey: ["users-for-assets"],
    queryFn: () => api<any>("/users?pageSize=100"),
    enabled: canManage,
  });

  const saveMutation = useMutation({
    mutationFn: (form: AssetForm) => editing
      ? api<any>(`/assets/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
      : api<any>("/assets", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: async () => {
      notify({ type: "success", message: editing ? "Asset updated" : "Asset created" });
      setEditing(null);
      reset(emptyForm);
      await qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e) => notify({ type: "error", message: (e as Error).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<any>(`/assets/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      notify({ type: "success", message: "Asset deleted" });
      await qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e) => notify({ type: "error", message: (e as Error).message }),
  });

  const startEdit = (row: AssetRow) => {
    setEditing(row);
    reset({
      code: row.code,
      name: row.name,
      type: row.type,
      status: row.status,
      purchaseDate: String(row.purchaseDate).slice(0, 10),
      cost: Number(row.cost),
      depreciationMonths: row.depreciationMonths,
      warehouseId: row.warehouse?.id ?? "",
      assignedUserId: row.assignedUser?.id ?? "",
      notes: row.notes ?? "",
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    reset(emptyForm);
  };

  const data = assetsQuery.data?.data;
  const rows: AssetRow[] = data?.items ?? [];
  const warehouses = warehousesQuery.data?.data ?? [];
  const users = usersQuery.data?.data?.items ?? usersQuery.data?.data ?? [];
  const fieldError = (key: keyof AssetForm) => errors[key] ? <p className="mt-1 text-xs text-[#9c4326]">{errors[key]?.message as string}</p> : null;

  return (
    <div className="space-y-4">
      {canManage ? (
        <Card>
          <div className="mb-2 font-semibold">{editing ? `Edit Asset: ${editing.code}` : "Create Asset"}</div>
          <form onSubmit={handleSubmit((form) => saveMutation.mutate(form))}>
            <div className="grid gap-2 md:grid-cols-3">
              <div><Input placeholder="Asset code (unique)" {...register("code")} />{fieldError("code")}</div>
              <div><Input placeholder="Asset name" {...register("name")} />{fieldError("name")}</div>
              <div><Input placeholder="Type (e.g. Freezer, Forklift, POS)" {...register("type")} />{fieldError("type")}</div>
              <div>
                <select className="field-warm h-11 w-full rounded border px-3 text-sm" {...register("status")}>
                  {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><Input type="date" title="Purchase date" {...register("purchaseDate")} />{fieldError("purchaseDate")}</div>
              <div><Input type="number" step="0.01" placeholder="Cost" {...register("cost")} />{fieldError("cost")}</div>
              <div><Input type="number" placeholder="Depreciation months (0 = none)" {...register("depreciationMonths")} />{fieldError("depreciationMonths")}</div>
              <div>
                <select className="field-warm h-11 w-full rounded border px-3 text-sm" {...register("warehouseId")}>
                  <option value="">No warehouse</option>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>
              <div>
                <select className="field-warm h-11 w-full rounded border px-3 text-sm" {...register("assignedUserId")}>
                  <option value="">Not assigned</option>
                  {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div className="md:col-span-3"><Input placeholder="Notes" {...register("notes")} /></div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Create Asset"}
              </Button>
              {editing ? <Button type="button" className="btn-muted-warm" onClick={cancelEdit}>Cancel</Button> : null}
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_180px_220px_auto]">
          <Input placeholder="Search by code, name, type..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="field-warm h-11 rounded border px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} title="Status filter">
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="field-warm h-11 rounded border px-3 text-sm" value={warehouseFilter} onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }} title="Warehouse filter">
            <option value="">All warehouses</option>
            {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="self-center text-xs text-muted-warm">Total: {data?.total ?? 0}</div>
        </div>
        <div className="overflow-auto">
          <table className="table-warm w-full min-w-[1280px] text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Code</th>
                <th className="px-3 py-2 text-left font-semibold">Name / Type</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Purchased</th>
                <th className="px-3 py-2 text-right font-semibold">Cost</th>
                <th className="px-3 py-2 text-right font-semibold">Current Value</th>
                <th className="px-3 py-2 text-left font-semibold">Warehouse</th>
                <th className="px-3 py-2 text-left font-semibold">Assigned To</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assetsQuery.isLoading ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-warm">Loading assets...</td></tr>
              ) : null}
              {!assetsQuery.isLoading && !rows.length ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-warm">No assets found.</td></tr>
              ) : null}
              {rows.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="px-3 py-2 font-medium">{a.code}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-warm">{a.type}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${statusBadge[a.status]}`}>{statusLabels[a.status]}</span>
                  </td>
                  <td className="px-3 py-2">{new Date(a.purchaseDate).toLocaleDateString("en-US")}</td>
                  <td className="px-3 py-2 text-right">{money(Number(a.cost))}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-medium">{money(a.currentValue)}</div>
                    <div className="text-xs text-muted-warm">
                      {a.depreciationMonths > 0 ? `${money(a.monthlyDepreciation)}/mo · ${a.monthsElapsed}/${a.depreciationMonths} mo` : "No depreciation"}
                    </div>
                  </td>
                  <td className="px-3 py-2">{a.warehouse?.name ?? "-"}</td>
                  <td className="px-3 py-2">{a.assignedUser?.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      {canManage ? (
                        <>
                          <button className="btn-secondary-warm inline-flex h-9 items-center gap-1 rounded px-3 text-xs font-semibold" onClick={() => startEdit(a)}>
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            className="btn-danger-warm inline-flex h-9 items-center gap-1 rounded px-3 text-xs font-semibold disabled:opacity-50"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (!window.confirm(`Delete asset ${a.code}?`)) return;
                              deleteMutation.mutate(a.id);
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </>
                      ) : <span className="text-xs text-muted-warm">Read-only</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button className="h-9 px-3 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-warm">Page {data?.page ?? 1} / {data?.totalPages ?? 1}</span>
          <Button className="h-9 px-3 text-xs" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </Card>
    </div>
  );
};
