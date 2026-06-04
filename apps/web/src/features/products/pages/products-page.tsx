import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Archive, Edit3, Filter, Plus, Send, Trash2, Upload, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../../../lib/api-client";
import { Button, Card, Input } from "../../../components/ui/basic";
import { useToast } from "../../../components/ui/toast";
import { useAuth } from "../../auth/auth-context";

const productStatus = (product: any) => {
  if (product.expiryStatus === "EXPIRED") return { label: "Expired", className: "border border-[#d77a55] bg-[#f0d1b0] text-[#9c4326]" };
  if (product.expiryStatus === "DESTROYED") return { label: "Destroyed", className: "border border-[#cdbf9f] bg-[#eadfc9] text-[#5d563f]" };
  if (product.isAlert3) return { label: "Alert", className: "border border-[#e77c4f] bg-[#f7c29b] text-[#9c4326]" };
  if (product.isWarning15) return { label: "Warning", className: "border border-[#e0bd63] bg-[#ffecbe] text-[#7d5c19]" };
  return { label: "Normal", className: "border border-[#a8c5a0] bg-[#dfead7] text-[#315f3d]" };
};

const productFieldClass = "border-[#e8c983] bg-[#ffecbe] text-[#4f4127] placeholder:text-[#8f7d5a] focus:ring-[#c55f3b]/20";
const productSelectClass = `h-11 rounded border px-3 text-sm outline-none focus:ring-2 ${productFieldClass}`;
const productSmallSelectClass = `h-9 rounded border px-2 text-xs outline-none focus:ring-2 ${productFieldClass}`;
const productGhostButtonClass = "rounded border border-[#d9bd80] bg-[#fff7e6] text-[#6f4f13] shadow-sm transition hover:border-[#c7a24e] hover:bg-[#ffecbe] active:translate-y-px";
const productToolbarButtonClass = "rounded border border-[#b7c5a3] bg-[#f4f6e9] text-[#315f3d] shadow-sm transition hover:border-[#8faa7d] hover:bg-[#e9f0dc] active:translate-y-px";
const productArchiveButtonClass = "rounded border border-[#d77a55] bg-[#f0d1b0] text-[#9c4326] shadow-sm transition hover:border-[#c55f3b] hover:bg-[#eebf9a] active:translate-y-px disabled:border-[#eadfc4] disabled:bg-[#f6efe1] disabled:text-[#b7a98d] disabled:opacity-100 disabled:shadow-none disabled:hover:border-[#eadfc4] disabled:hover:bg-[#f6efe1]";
const productTerracottaButtonClass = "rounded border border-[#b94f2e] bg-[#c55f3b] text-[#fff9ee] shadow-sm hover:bg-[#b35228]";
const productDuplicateButtonClass = "rounded border border-[#9db17d] bg-[#718b4d] text-[#fff9ee] shadow-sm hover:bg-[#61783f]";
const productEditButtonClass = "rounded border border-[#789caf] bg-[#4f7f93] text-white shadow-sm hover:bg-[#416f82]";
const productDeleteButtonClass = "rounded border border-[#d77a55] bg-[#e77c4f] text-white shadow-sm hover:bg-[#cf673d]";

const toDateInput = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : "";

const requestFields = [
  "name", "brand", "manufacturer", "sku", "barcode", "type", "unit", "costPrice", "sellingPrice",
  "reorderLevel", "productionDate", "expiryDate", "categoryId", "supplierId", "imageUrl", "notes",
];

const buildEditForm = (product: any) => ({
  name: product.name ?? "",
  brand: product.brand ?? "",
  manufacturer: product.manufacturer ?? "",
  sku: product.sku ?? "",
  barcode: product.barcode ?? "",
  type: product.type ?? "DRY_GOODS",
  unit: product.unit ?? "PIECE",
  costPrice: String(product.costPrice ?? "0"),
  sellingPrice: String(product.sellingPrice ?? "0"),
  reorderLevel: String(product.reorderLevel ?? "0"),
  productionDate: toDateInput(product.productionDate),
  expiryDate: toDateInput(product.expiryDate),
  categoryId: product.categoryId ?? "",
  supplierId: product.supplierId ?? "",
  imageUrl: product.imageUrl ?? "",
  notes: product.notes ?? "",
});

const buildDirectUpdatePayload = (product: any, editForm: Record<string, string>) => ({
  name: editForm.name,
  brand: editForm.brand || undefined,
  manufacturer: editForm.manufacturer || undefined,
  sku: editForm.sku,
  barcode: editForm.barcode || undefined,
  type: editForm.type,
  unit: editForm.unit,
  costPrice: Number(editForm.costPrice || 0),
  sellingPrice: Number(editForm.sellingPrice || 0),
  currentStock: Number(product.currentStock ?? 0),
  reorderLevel: Number(editForm.reorderLevel || 0),
  productionDate: editForm.productionDate ? new Date(editForm.productionDate).toISOString() : null,
  expiryDate: editForm.expiryDate ? new Date(editForm.expiryDate).toISOString() : null,
  categoryId: editForm.categoryId,
  supplierId: editForm.supplierId || null,
  notes: editForm.notes || undefined,
  imageUrl: editForm.imageUrl || undefined,
});

const parseCsv = (text: string) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return headers.reduce((acc: Record<string, string>, header, index) => {
      acc[header] = cells[index] ?? "";
      return acc;
    }, {});
  });
};

const toIsoOrNull = (value?: string) => {
  if (!value?.trim()) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

const defaultProductForm = {
  name: "",
  brand: "",
  manufacturer: "",
  sku: "",
  barcode: "",
  type: "DRY_GOODS",
  unit: "PIECE",
  costPrice: "0",
  sellingPrice: "0",
  currentStock: "0",
  reorderLevel: "5",
  productionDate: "",
  expiryDate: "",
  categoryId: "",
  supplierId: "",
  notes: "",
  imageUrl: "",
};

const presetOptions = [
  ["all", "All Products"],
  ["stockValue", "Stock Value Focus"],
  ["expiringSoon", "Expiring Soon"],
  ["expired", "Expired"],
  ["lowStock", "Low Stock"],
];

export const ProductsPage = () => {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canDirectManage = ["ADMIN", "MANAGER"].includes(user?.role ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [preset, setPreset] = useState(searchParams.get("preset") ?? "all");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("categoryId") ?? "");
  const [supplierFilter, setSupplierFilter] = useState(searchParams.get("supplierId") ?? "");
  const [expiryStatusFilter, setExpiryStatusFilter] = useState(searchParams.get("expiryStatus") ?? "");
  const [stockLevelFilter, setStockLevelFilter] = useState(searchParams.get("stockLevel") ?? "");
  const [minPriceFilter, setMinPriceFilter] = useState(searchParams.get("minPrice") ?? "");
  const [maxPriceFilter, setMaxPriceFilter] = useState(searchParams.get("maxPrice") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") ?? "updatedAt");
  const [sortOrder, setSortOrder] = useState(searchParams.get("sortOrder") ?? "desc");
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page") ?? 1)));
  const [pageSize, setPageSize] = useState(Math.max(10, Number(searchParams.get("pageSize") ?? 20)));
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionModal, setActionModal] = useState<{ mode: "edit" | "delete"; product: any } | null>(null);
  const [importing, setImporting] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [requestReason, setRequestReason] = useState("");
  const [form, setForm] = useState(defaultProductForm);
  const { notify } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
    setPreset(searchParams.get("preset") ?? "all");
    setCategoryFilter(searchParams.get("categoryId") ?? "");
    setSupplierFilter(searchParams.get("supplierId") ?? "");
    setExpiryStatusFilter(searchParams.get("expiryStatus") ?? "");
    setStockLevelFilter(searchParams.get("stockLevel") ?? "");
    setMinPriceFilter(searchParams.get("minPrice") ?? "");
    setMaxPriceFilter(searchParams.get("maxPrice") ?? "");
    setSortBy(searchParams.get("sortBy") ?? "updatedAt");
    setSortOrder(searchParams.get("sortOrder") ?? "desc");
    setPage(Math.max(1, Number(searchParams.get("page") ?? 1)));
    setPageSize(Math.max(10, Number(searchParams.get("pageSize") ?? 20)));
  }, [searchParams]);

  const productQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (expiryStatusFilter) params.set("expiryStatus", expiryStatusFilter);
    if (stockLevelFilter) params.set("stockLevel", stockLevelFilter);
    if (minPriceFilter) params.set("minPrice", minPriceFilter);
    if (maxPriceFilter) params.set("maxPrice", maxPriceFilter);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("preset", preset);
    return params.toString();
  }, [
    debouncedSearch,
    categoryFilter,
    supplierFilter,
    expiryStatusFilter,
    stockLevelFilter,
    minPriceFilter,
    maxPriceFilter,
    sortBy,
    sortOrder,
    page,
    pageSize,
    preset,
  ]);

  const q = useQuery({
    queryKey: ["products", productQuery],
    queryFn: () => api<any>(`/products?${productQuery}`),
  });
  const cats = useQuery({ queryKey: ["cats"], queryFn: () => api<any>("/categories") });
  const sups = useQuery({ queryKey: ["sups"], queryFn: () => api<any>("/suppliers") });
  const systemSettings = useQuery({
    queryKey: ["settings-system"],
    queryFn: () => api<any>("/settings/system"),
    staleTime: 300000,
  });
  const lowStockThreshold = Number(systemSettings.data?.data?.operations?.lowStockThreshold ?? 5);

  useEffect(() => {
    const defaultReorderLevel = Number(systemSettings.data?.data?.operations?.defaultReorderLevel);
    if (!Number.isFinite(defaultReorderLevel)) return;
    setForm((prev) => {
      if (prev.reorderLevel && prev.reorderLevel !== "5") return prev;
      return { ...prev, reorderLevel: String(defaultReorderLevel) };
    });
  }, [systemSettings.data?.data?.operations?.defaultReorderLevel]);

  const create = useMutation({
    mutationFn: (payload: any) =>
      api("/products", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      notify({ type: "success", message: "Product created" });
      setError("");
      setShowCreateModal(false);
      setForm(defaultProductForm);
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => {
      const message = (e as Error).message;
      setError(message);
      notify({ type: "error", message });
    },
  });

  const directUpdate = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      notify({ type: "success", message: "Product updated" });
      setError("");
      setActionModal(null);
      setEditForm({});
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["recent"] }),
        qc.invalidateQueries({ queryKey: ["kpi"] }),
        qc.invalidateQueries({ queryKey: ["stock-by-cat"] }),
      ]);
    },
    onError: (e) => {
      const message = (e as Error).message;
      setError(message);
      notify({ type: "error", message });
    },
  });

  const directDelete = useMutation({
    mutationFn: (id: string) =>
      api(`/products/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      notify({ type: "success", message: "Product deleted" });
      setError("");
      setActionModal(null);
      setEditForm({});
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["recent"] }),
        qc.invalidateQueries({ queryKey: ["kpi"] }),
        qc.invalidateQueries({ queryKey: ["stock-by-cat"] }),
      ]);
    },
    onError: (e) => {
      const message = (e as Error).message;
      setError(message);
      notify({ type: "error", message });
    },
  });

  const approvalRequest = useMutation({
    mutationFn: (payload: any) =>
      api("/approvals/product", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      notify({ type: "success", message: "Approval request sent" });
      setError("");
      setActionModal(null);
      setRequestReason("");
      setEditForm({});
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["approval-pending-count"] }),
        qc.invalidateQueries({ queryKey: ["approval-pending-list"] }),
      ]);
    },
    onError: (e) => {
      const message = (e as Error).message;
      setError(message);
      notify({ type: "error", message });
    },
  });

  const duplicateProduct = useMutation({
    mutationFn: (id: string) => api(`/products/${id}/duplicate`, { method: "POST" }),
    onSuccess: async () => {
      notify({ type: "success", message: "Product duplicated" });
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => {
      const message = (e as Error).message;
      setError(message);
      notify({ type: "error", message });
    },
  });

  const bulkArchive = useMutation({
    mutationFn: (productIds: string[]) =>
      api("/products/bulk/archive", { method: "POST", body: JSON.stringify({ productIds }) }),
    onSuccess: async (result: any) => {
      notify({ type: "success", message: `Archived ${result?.data?.archivedCount ?? selectedIds.length} products` });
      setSelectedIds([]);
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => {
      const message = (e as Error).message;
      setError(message);
      notify({ type: "error", message });
    },
  });

  const profitMarginPreview = useMemo(() => {
    const c = Number(form.costPrice);
    const s = Number(form.sellingPrice);
    if (!c || c <= 0) return 0;
    return ((s - c) / c) * 100;
  }, [form.costPrice, form.sellingPrice]);

  const expiryPreview = useMemo(() => {
    if (!form.expiryDate) return null;
    const days = Math.floor(
      (new Date(form.expiryDate).getTime() - Date.now()) / 86400000,
    );
    return {
      days,
      isWarning15: days >= 4 && days <= 15,
      isAlert3: days >= 0 && days <= 3,
    };
  }, [form.expiryDate]);

  const submit = () => {
    if (!form.name || !form.sku || !form.categoryId) {
      const message = "Name, SKU and category are required";
      setError(message);
      notify({ type: "warning", message });
      return;
    }
    setError("");
    create.mutate({
      name: form.name,
      brand: form.brand || undefined,
      manufacturer: form.manufacturer || undefined,
      sku: form.sku,
      barcode: form.barcode || undefined,
      type: form.type,
      unit: form.unit,
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      currentStock: Number(form.currentStock),
      reorderLevel: Number(form.reorderLevel),
      productionDate: form.productionDate
        ? new Date(form.productionDate).toISOString()
        : null,
      expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
      categoryId: form.categoryId,
      supplierId: form.supplierId || null,
      notes: form.notes || undefined,
      imageUrl: form.imageUrl || undefined,
    });
  };

  const openEditRequest = (product: any) => {
    setError("");
    setActionModal({ mode: "edit", product });
    setEditForm(buildEditForm(product));
    setRequestReason("");
  };

  const openDeleteRequest = (product: any) => {
    setError("");
    setActionModal({ mode: "delete", product });
    setRequestReason("");
    setEditForm({});
  };

  const sendApprovalRequest = () => {
    if (!actionModal) return;
    if (requestReason.trim().length < 8) {
      const message = "Reason must be at least 8 characters";
      setError(message);
      notify({ type: "warning", message });
      return;
    }

    if (actionModal.mode === "delete") {
      approvalRequest.mutate({
        productId: actionModal.product.id,
        type: "PRODUCT_DELETE",
        reason: requestReason.trim(),
      });
      return;
    }

    const original: Record<string, string> = buildEditForm(actionModal.product);
    const requestedChanges: Record<string, unknown> = {};
    for (const field of requestFields) {
      if ((editForm[field] ?? "") !== (original[field] ?? "")) {
        if (["costPrice", "sellingPrice", "reorderLevel"].includes(field)) requestedChanges[field] = Number(editForm[field] || 0);
        else if (field === "productionDate" || field === "expiryDate") requestedChanges[field] = editForm[field] ? new Date(editForm[field]).toISOString() : null;
        else if (field === "supplierId" || field === "brand" || field === "manufacturer" || field === "barcode" || field === "imageUrl") requestedChanges[field] = editForm[field] || null;
        else requestedChanges[field] = editForm[field] ?? "";
      }
    }

    if (Object.keys(requestedChanges).length === 0) {
      const message = "Change at least one field before sending an edit request";
      setError(message);
      notify({ type: "warning", message });
      return;
    }

    approvalRequest.mutate({
      productId: actionModal.product.id,
      type: "PRODUCT_UPDATE",
      reason: requestReason.trim(),
      requestedChanges,
    });
  };

  const submitDirectAction = () => {
    if (!actionModal) return;

    if (actionModal.mode === "delete") {
      directDelete.mutate(actionModal.product.id);
      return;
    }

    const payload = buildDirectUpdatePayload(actionModal.product, editForm);
    if (!payload.name || !payload.sku || !payload.categoryId) {
      const message = "Name, SKU and category are required";
      setError(message);
      notify({ type: "warning", message });
      return;
    }
    if (payload.costPrice < 0 || payload.sellingPrice < 0 || payload.reorderLevel < 0) {
      const message = "Price and reorder level must be non-negative";
      setError(message);
      notify({ type: "warning", message });
      return;
    }
    directUpdate.mutate({ id: actionModal.product.id, payload });
  };

  const handlePrimaryAction = () => {
    if (canDirectManage) {
      submitDirectAction();
      return;
    }
    sendApprovalRequest();
  };

  const rows = q.data?.data?.items ?? [];
  const total = Number(q.data?.data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const queryError = q.error as Error | null;
  const primaryActionPending = canDirectManage
    ? (actionModal?.mode === "delete" ? directDelete.isPending : directUpdate.isPending)
    : approvalRequest.isPending;
  const allSelected = rows.length > 0 && rows.every((item: any) => selectedIds.includes(item.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !rows.some((row: any) => row.id === id)));
      return;
    }
    const merged = new Set([...selectedIds, ...rows.map((row: any) => row.id)]);
    setSelectedIds(Array.from(merged));
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const content = await file.text();
      const rows = parseCsv(content);
      const items = rows.map((row) => ({
        name: row.name,
        brand: row.brand || undefined,
        manufacturer: row.manufacturer || undefined,
        sku: row.sku,
        barcode: row.barcode || undefined,
        type: row.type || "DRY_GOODS",
        unit: row.unit || "PIECE",
        costPrice: Number(row.costPrice || 0),
        sellingPrice: Number(row.sellingPrice || 0),
        currentStock: Number(row.currentStock || 0),
        reorderLevel: Number(row.reorderLevel || 0),
        productionDate: toIsoOrNull(row.productionDate),
        expiryDate: toIsoOrNull(row.expiryDate),
        categoryId: row.categoryId,
        supplierId: row.supplierId || null,
        imageUrl: row.imageUrl || undefined,
        notes: row.notes || undefined,
        overwriteBySku: true,
      }));
      const result = await api<any>("/products/import", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      const summary = result?.data?.summary;
      notify({
        type: "success",
        message: `Import done. Created: ${summary?.created ?? 0}, Updated: ${summary?.updated ?? 0}, Skipped: ${summary?.skipped ?? 0}`,
      });
      await qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e: any) {
      const message = e?.message || "Import failed";
      setError(message);
      notify({ type: "error", message });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const resetFilters = () => {
    setCategoryFilter("");
    setSupplierFilter("");
    setExpiryStatusFilter("");
    setStockLevelFilter("");
    setMinPriceFilter("");
    setMaxPriceFilter("");
    setSortBy("updatedAt");
    setSortOrder("desc");
    setPreset("all");
    setPage(1);
  };

  const openCreateModal = () => {
    setError("");
    setShowCreateModal(true);
  };

  const activeFilterCount = [
    preset !== "all",
    Boolean(categoryFilter),
    Boolean(supplierFilter),
    Boolean(expiryStatusFilter),
    Boolean(stockLevelFilter),
    Boolean(minPriceFilter),
    Boolean(maxPriceFilter),
    sortBy !== "updatedAt",
    sortOrder !== "desc",
  ].filter(Boolean).length;

  return (
    <div className="products-theme space-y-4">
      {queryError ? (
        <Card>
          <p className="text-sm text-[#9c4326]">{queryError.message}</p>
        </Card>
      ) : null}
      <Card>
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto] lg:items-center">
          <Input
            className={productFieldClass}
            placeholder="Search by product name, SKU, brand..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className={productSelectClass}
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              setPage(1);
            }}
          >
            {presetOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              className={`inline-flex h-11 items-center gap-2 px-3 text-sm font-semibold ${productToolbarButtonClass}`}
              onClick={() => setShowAdvancedFilters((value) => !value)}
            >
              <Filter size={16} /> Filters {activeFilterCount ? `(${activeFilterCount})` : ""}
            </button>
            <label className={`inline-flex h-11 cursor-pointer items-center gap-2 px-3 text-sm font-semibold ${productToolbarButtonClass}`}>
              <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
              <Upload size={16} /> {importing ? "Importing..." : "Import CSV"}
            </label>
            <button
              className={`inline-flex h-11 items-center gap-2 px-3 text-sm font-medium ${productArchiveButtonClass}`}
              disabled={!selectedIds.length || bulkArchive.isPending}
              onClick={() => bulkArchive.mutate(selectedIds)}
            >
              <Archive size={16} /> Archive ({selectedIds.length})
            </button>
            <Button className="inline-flex items-center gap-2" onClick={openCreateModal}>
              <Plus size={16} /> Create
            </Button>
          </div>
        </div>
        {activeFilterCount ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[#6d5935]">Applied:</span>
            {preset !== "all" ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">{presetOptions.find(([key]) => key === preset)?.[1]}</span> : null}
            {categoryFilter ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">Category</span> : null}
            {supplierFilter ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">Supplier</span> : null}
            {expiryStatusFilter ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">Expiry: {expiryStatusFilter}</span> : null}
            {stockLevelFilter ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">Stock: {stockLevelFilter}</span> : null}
            {minPriceFilter || maxPriceFilter ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">Price range</span> : null}
            {sortBy !== "updatedAt" || sortOrder !== "desc" ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">Custom sort</span> : null}
            <button className="text-xs font-semibold text-[#b35228] hover:underline" onClick={resetFilters}>Clear all</button>
          </div>
        ) : null}
        {showAdvancedFilters ? (
          <div className="mt-4 rounded-md border border-[#ead6aa] bg-[#fff9ee] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-[#2f2b20]">Advanced filters</div>
                <div className="text-xs text-[#8f7d5a]">Keep rare filters here so the product table stays compact.</div>
              </div>
              <button className={`h-9 px-3 text-xs font-medium ${productGhostButtonClass}`} onClick={resetFilters}>Reset</button>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <select className={productSelectClass} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                <option value="">All categories</option>
                {(cats.data?.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={productSelectClass} value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}>
                <option value="">All suppliers</option>
                {(sups.data?.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className={productSelectClass} value={expiryStatusFilter} onChange={(e) => { setExpiryStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All expiry status</option>
                <option value="NORMAL">Normal</option>
                <option value="WARNING_15">Warning 4-15 days</option>
                <option value="ALERT_3">Alert 0-3 days</option>
                <option value="EXPIRED">Expired</option>
                <option value="DESTROYED">Destroyed</option>
              </select>
              <select className={productSelectClass} value={stockLevelFilter} onChange={(e) => { setStockLevelFilter(e.target.value); setPage(1); }}>
                <option value="">All stock levels</option>
                <option value="LOW">Low stock ({"<="} {lowStockThreshold})</option>
                <option value="OUT">Out of stock</option>
                <option value="NORMAL">Normal stock ({">"} {lowStockThreshold})</option>
              </select>
              <Input className={productFieldClass} placeholder="Min price" type="number" min={0} value={minPriceFilter} onChange={(e) => { setMinPriceFilter(e.target.value); setPage(1); }} />
              <Input className={productFieldClass} placeholder="Max price" type="number" min={0} value={maxPriceFilter} onChange={(e) => { setMaxPriceFilter(e.target.value); setPage(1); }} />
              <select className={productSelectClass} value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
                <option value="updatedAt">Sort by updated time</option>
                <option value="name">Sort by name</option>
                <option value="sellingPrice">Sort by selling price</option>
                <option value="costPrice">Sort by cost price</option>
                <option value="currentStock">Sort by stock</option>
                <option value="expiryDate">Sort by expiry date</option>
              </select>
              <select className={productSelectClass} value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}>
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>
        ) : null}
      </Card>
      <Card>
        <div className="overflow-auto">
          <table className="w-full min-w-[1380px] table-fixed border-separate border-spacing-0 text-sm">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead><tr className="bg-[#f2dfb8] text-[#2f2b20]"><th className="border-b border-[#d9bd80] px-2 py-3 text-left font-semibold"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th><th className="border-b border-[#d9bd80] px-6 py-3 text-left font-semibold">Name</th><th className="border-b border-[#d9bd80] px-6 py-3 text-left font-semibold">SKU</th><th className="border-b border-[#d9bd80] px-6 py-3 text-left font-semibold">Brand</th><th className="border-b border-[#d9bd80] px-6 py-3 text-left font-semibold">Stock</th><th className="border-b border-[#d9bd80] px-6 py-3 text-left font-semibold">Status</th><th className="border-b border-[#d9bd80] px-6 py-3 text-right font-semibold">Action</th></tr></thead>
            <tbody>{rows.map((p: any) => {
              const status = productStatus(p);
              return <tr key={p.id} className="bg-[#fbf7ee] transition-colors hover:bg-[#fff0cf]"><td className="border-b border-[#ead6aa] px-2 py-4 align-middle"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={(e) => setSelectedIds((prev) => e.target.checked ? Array.from(new Set([...prev, p.id])) : prev.filter((id) => id !== p.id))} /></td><td className="truncate border-b border-[#ead6aa] px-6 py-4 font-medium text-[#2f2b20] align-middle" title={p.name}>{p.name}</td><td className="truncate border-b border-[#ead6aa] px-6 py-4 text-[#6d5935] align-middle" title={p.sku}>{p.sku}</td><td className="truncate border-b border-[#ead6aa] px-6 py-4 text-[#6d5935] align-middle" title={p.brand ?? "-"}>{p.brand ?? "-"}</td><td className="border-b border-[#ead6aa] px-6 py-4 text-left font-medium tabular-nums text-[#2f2b20] align-middle">{p.currentStock}</td><td className="border-b border-[#ead6aa] px-6 py-4 align-middle"><span className={`inline-flex min-w-24 justify-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${status.className}`}>{status.label}</span></td><td className="border-b border-[#ead6aa] px-6 py-4 align-middle"><div className="flex flex-nowrap justify-end gap-2"><button onClick={() => duplicateProduct.mutate(p.id)} className={`inline-flex h-9 items-center gap-2 px-3 text-xs font-semibold transition active:translate-y-px ${productDuplicateButtonClass}`}>Duplicate</button><button onClick={() => openEditRequest(p)} className={`inline-flex h-9 items-center gap-2 px-3 text-xs font-semibold transition active:translate-y-px ${productEditButtonClass}`}><Edit3 size={14} /> Edit</button><button onClick={() => openDeleteRequest(p)} className={`inline-flex h-9 items-center gap-2 px-3 text-xs font-semibold transition active:translate-y-px ${productDeleteButtonClass}`}><Trash2 size={14} /> Delete</button></div></td></tr>;
            })}
            {q.isLoading ? (
              <tr>
                <td colSpan={7} className="border-b border-[#ead6aa] px-6 py-8 text-center text-[#8f7d5a]">Loading products...</td>
              </tr>
            ) : null}
            {!q.isLoading && !rows.length ? (
              <tr>
                <td colSpan={7} className="border-b border-[#ead6aa] px-6 py-8 text-center text-[#8f7d5a]">No products found.</td>
              </tr>
            ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-[#8f7d5a]">Total products: {total}</div>
          <div className="flex items-center gap-2">
            <select
              className={productSmallSelectClass}
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
            <button className={`h-9 px-3 disabled:opacity-40 ${productGhostButtonClass}`} disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
              Previous
            </button>
            <span>Page {page} / {totalPages}</span>
            <button className={`h-9 px-3 disabled:opacity-40 ${productGhostButtonClass}`} disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>
              Next
            </button>
          </div>
        </div>
      </Card>
      {showCreateModal ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#2f2719]/45 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-md border border-[#ead6aa] bg-[#fff9ee] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#ead6aa] bg-[#f7ebd5] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#ffecbe] px-2 py-1 text-xs font-semibold text-[#8b6727]">New product</span>
                  <h2 className="text-lg font-semibold">Create Product</h2>
                </div>
                <p className="mt-1 text-sm text-[#8f7d5a]">Fill the product basics, pricing, stock and expiry data in one focused modal.</p>
              </div>
              <button
                className={`grid h-9 w-9 place-items-center ${productGhostButtonClass}`}
                onClick={() => {
                  if (!create.isPending) setShowCreateModal(false);
                }}
                aria-label="Close create product modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[74vh] overflow-auto p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <Input className={productFieldClass} placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input className={productFieldClass} placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                <Input className={productFieldClass} placeholder="Manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
                <Input className={productFieldClass} placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                <Input className={productFieldClass} placeholder="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                <select className={productSelectClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="FRESH_FOOD">Fresh Food</option><option value="DRY_GOODS">Dry Goods</option><option value="COSMETICS">Cosmetics</option><option value="HOUSEHOLD">Household</option><option value="CUSTOM">Custom</option>
                </select>
                <select className={productSelectClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option value="PIECE">PIECE</option><option value="KG">KG</option><option value="G">G</option><option value="L">L</option><option value="ML">ML</option><option value="BOX">BOX</option>
                </select>
                <select className={productSelectClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Select category</option>{(cats.data?.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className={productSelectClass} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="">Select supplier</option>{(sups.data?.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Input className={productFieldClass} placeholder="Cost price" type="number" min={0} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
                <Input className={productFieldClass} placeholder="Selling price" type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
                <Input className={productFieldClass} placeholder="Current stock" type="number" min={0} value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
                <Input className={productFieldClass} placeholder="Reorder level" type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
                <Input className={productFieldClass} type="date" value={form.productionDate} onChange={(e) => setForm({ ...form, productionDate: e.target.value })} />
                <Input className={productFieldClass} type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
                <Input className={productFieldClass} placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
                <Input className={productFieldClass} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div className="mt-4 flex flex-wrap gap-3 rounded-md border border-[#ead6aa] bg-[#fff4d9] px-3 py-2 text-xs text-[#6d5935]">
                <span>Profit margin preview: <b>{profitMarginPreview.toFixed(2)}%</b></span>
                {expiryPreview ? <span>Days until expiry: <b>{expiryPreview.days}</b></span> : null}
                {expiryPreview?.isWarning15 ? <span className="font-medium text-[#8b6727]">Warning 15 days active</span> : null}
                {expiryPreview?.isAlert3 ? <span className="font-medium text-[#9c4326]">Alert 3 days active</span> : null}
              </div>
              {error ? <p className="mt-3 rounded border border-[#d77a55] bg-[#f0d1b0] px-3 py-2 text-sm text-[#9c4326]">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#ead6aa] bg-[#f7ebd5] px-5 py-4">
              <button
                className={`h-11 px-4 text-sm font-medium ${productGhostButtonClass}`}
                onClick={() => setShowCreateModal(false)}
                disabled={create.isPending}
              >
                Cancel
              </button>
              <Button className="inline-flex items-center gap-2" onClick={submit} disabled={create.isPending}>
                <Plus size={16} /> {create.isPending ? "Creating..." : "Create Product"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {actionModal ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#2f2719]/45 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-md border border-[#ead6aa] bg-[#fff9ee] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#ead6aa] bg-[#f7ebd5] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${actionModal.mode === "delete" ? "bg-[#f0d1b0] text-[#9c4326]" : "bg-[#d6e7e4] text-[#315f6b]"}`}>
                    {actionModal.mode === "delete"
                      ? (canDirectManage ? "Delete" : "Delete request")
                      : (canDirectManage ? "Edit" : "Edit request")}
                  </span>
                  <h2 className="text-lg font-semibold">{actionModal.product.name}</h2>
                </div>
                <p className="mt-1 text-sm text-[#8f7d5a]">
                  {canDirectManage
                    ? (actionModal.mode === "delete"
                      ? "Confirm to delete this product now."
                      : "Confirm to save product changes now.")
                    : "Send this request to manager and admin for approval."}
                </p>
              </div>
              <button className={`grid h-9 w-9 place-items-center ${productGhostButtonClass}`} onClick={() => setActionModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[74vh] overflow-auto p-5">
              {actionModal.mode === "edit" ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <Input className={productFieldClass} placeholder="Product name" value={editForm.name ?? ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <Input className={productFieldClass} placeholder="Brand" value={editForm.brand ?? ""} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} />
                  <Input className={productFieldClass} placeholder="Manufacturer" value={editForm.manufacturer ?? ""} onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })} />
                  <Input className={productFieldClass} placeholder="SKU" value={editForm.sku ?? ""} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} />
                  <Input className={productFieldClass} placeholder="Barcode" value={editForm.barcode ?? ""} onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })} />
                  <select className={productSelectClass} value={editForm.type ?? "DRY_GOODS"} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                    <option value="FRESH_FOOD">Fresh Food</option><option value="DRY_GOODS">Dry Goods</option><option value="COSMETICS">Cosmetics</option><option value="HOUSEHOLD">Household</option><option value="CUSTOM">Custom</option>
                  </select>
                  <select className={productSelectClass} value={editForm.unit ?? "PIECE"} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}>
                    <option value="PIECE">PIECE</option><option value="KG">KG</option><option value="G">G</option><option value="L">L</option><option value="ML">ML</option><option value="BOX">BOX</option>
                  </select>
                  <select className={productSelectClass} value={editForm.categoryId ?? ""} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
                    <option value="">Select category</option>{(cats.data?.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className={productSelectClass} value={editForm.supplierId ?? ""} onChange={(e) => setEditForm({ ...editForm, supplierId: e.target.value })}>
                    <option value="">Select supplier</option>{(sups.data?.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <Input className={productFieldClass} placeholder="Cost price" type="number" min={0} value={editForm.costPrice ?? "0"} onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })} />
                  <Input className={productFieldClass} placeholder="Selling price" type="number" min={0} value={editForm.sellingPrice ?? "0"} onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })} />
                  <Input className={productFieldClass} placeholder="Reorder level" type="number" min={0} value={editForm.reorderLevel ?? "0"} onChange={(e) => setEditForm({ ...editForm, reorderLevel: e.target.value })} />
                  <Input className={productFieldClass} type="date" value={editForm.productionDate ?? ""} onChange={(e) => setEditForm({ ...editForm, productionDate: e.target.value })} />
                  <Input className={productFieldClass} type="date" value={editForm.expiryDate ?? ""} onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })} />
                  <Input className={productFieldClass} placeholder="Image URL" value={editForm.imageUrl ?? ""} onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })} />
                  <Input className={productFieldClass} placeholder="Notes" value={editForm.notes ?? ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
              ) : (
                <div className="rounded-md border border-[#d77a55] bg-[#f0d1b0] p-4 text-sm text-[#9c4326]">
                  {canDirectManage
                    ? "This action will remove the product from active operations immediately."
                    : "This will request removal of the product from active operations. Inventory and audit history stay available."}
                </div>
              )}

              {!canDirectManage ? (
                <div className="mt-4">
                  <label className="text-sm font-medium text-[#4f4127]">Reason for approval</label>
                  <textarea
                    className={`mt-2 min-h-28 w-full rounded border px-3 py-2 text-sm outline-none focus:ring-2 ${productFieldClass}`}
                    placeholder="Explain why this product should be updated or deleted..."
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                  />
                </div>
              ) : null}
              {error ? <p className="mt-3 text-sm text-[#9c4326]">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#ead6aa] bg-[#f7ebd5] px-5 py-4">
              <button className={`h-11 px-4 text-sm font-medium ${productGhostButtonClass}`} onClick={() => setActionModal(null)}>Cancel</button>
              <Button className="inline-flex items-center gap-2" onClick={handlePrimaryAction} disabled={primaryActionPending}>
                <Send size={16} /> {canDirectManage ? "Confirm" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

