import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../../lib/api-client";
import { Button, Card, Input } from "../../../components/ui/basic";

const readItems = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const InventoryPage = () => {
  const [type, setType] = useState<"in" | "out" | "adjustment" | "destroy">("in");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [adjustmentDirection, setAdjustmentDirection] = useState<"increase" | "decrease">("increase");
  const [reason, setReason] = useState("");
  const [destroyReason, setDestroyReason] = useState("DAMAGED");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [deliveredByName, setDeliveredByName] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");
  const [txWarehouseFilter, setTxWarehouseFilter] = useState("");
  const [txFrom, setTxFrom] = useState("");
  const [txTo, setTxTo] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  const products = useQuery({
    queryKey: ["inventory-products"],
    queryFn: () => api<any>("/products?page=1&pageSize=100"),
  });
  const suppliers = useQuery({
    queryKey: ["inventory-suppliers"],
    queryFn: () => api<any>("/suppliers"),
  });
  const warehouses = useQuery({
    queryKey: ["inventory-warehouses"],
    queryFn: () => api<any>("/warehouses"),
  });
  const reasonOptions = useQuery({
    queryKey: ["inventory-reason-options"],
    queryFn: () => api<any>("/inventory/reason-options"),
  });
  const txQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(txPage));
    params.set("pageSize", String(txPageSize));
    if (txTypeFilter) params.set("type", txTypeFilter);
    if (txWarehouseFilter) params.set("warehouseId", txWarehouseFilter);
    if (txSearch.trim()) params.set("search", txSearch.trim());
    if (txFrom) params.set("from", txFrom);
    if (txTo) params.set("to", txTo);
    return params.toString();
  }, [txPage, txPageSize, txTypeFilter, txWarehouseFilter, txSearch, txFrom, txTo]);
  const tx = useQuery({
    queryKey: ["inventory-transactions", txQuery],
    queryFn: () => api<any>(`/inventory/transactions?${txQuery}`),
  });
  const qc = useQueryClient();

  const mutate = useMutation({
    mutationFn: () => {
      const numericQty = Number(quantity);
      const normalizedQuantity = type === "adjustment"
        ? (adjustmentDirection === "decrease" ? -Math.abs(numericQty) : Math.abs(numericQty))
        : Math.abs(numericQty);
      return (
      api(`/inventory/${type}`, {
        method: "POST",
        body: JSON.stringify({
          productId,
          quantity: normalizedQuantity,
          warehouseId: warehouseId || undefined,
          reason,
          destroyReason: type === "destroy" ? destroyReason : undefined,
          invoiceNumber: invoiceNumber || undefined,
          supplierName: supplierName || undefined,
          deliveredByName: deliveredByName || undefined,
          deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : undefined,
        }),
      })
      );
    },
    onSuccess: () => {
      setMutationError("");
      setReason("");
      setQuantity("1");
      setInvoiceNumber("");
      setSupplierName("");
      setWarehouseId("");
      setDeliveredByName("");
      setDeliveredAt("");
      setDestroyReason("DAMAGED");
      setAdjustmentDirection("increase");
      setShowTransactionModal(false);
      qc.invalidateQueries({ queryKey: ["inventory-transactions"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => setMutationError((err as Error).message),
  });

  const productItems = readItems(products.data?.data);
  const supplierItems = readItems(suppliers.data?.data);
  const warehouseItems = readItems(warehouses.data?.data);
  const typeKey = type.toUpperCase();
  const reasonItems: string[] = reasonOptions.data?.data?.[typeKey] ?? [];
  const txItems = readItems(tx.data?.data);
  const txTotal = Number(tx.data?.data?.total ?? 0);
  const txTotalPages = Math.max(1, Math.ceil(txTotal / txPageSize));
  const queryError = (products.error ?? suppliers.error ?? warehouses.error ?? tx.error) as Error | null;
  const activeFilterCount = [
    Boolean(txTypeFilter),
    Boolean(txWarehouseFilter),
    Boolean(txFrom),
    Boolean(txTo),
    txPageSize !== 20,
  ].filter(Boolean).length;

  const resetTransactionFilters = () => {
    setTxTypeFilter("");
    setTxWarehouseFilter("");
    setTxFrom("");
    setTxTo("");
    setTxPageSize(20);
    setTxPage(1);
  };

  return (
    <div className="space-y-4">
      <Card>
        {queryError ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded border border-[#d77a55] bg-[#f0d1b0] px-3 py-2">
            <p className="text-sm text-[#9c4326]">{queryError.message}</p>
            <button
              className="btn-danger-warm h-8 rounded px-3 text-xs"
              onClick={() => {
                products.refetch();
                suppliers.refetch();
                warehouses.refetch();
                tx.refetch();
              }}
            >
              Retry
            </button>
          </div>
        ) : null}
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Button className="h-11 px-4" onClick={() => setShowTransactionModal(true)}>
            Submit Transaction
          </Button>
          <div className="grid w-full gap-2 lg:w-[40%] lg:grid-cols-[minmax(0,1fr)_150px_auto] lg:items-center">
            <Input
              placeholder="Search transaction..."
              value={txSearch}
              onChange={(e) => { setTxSearch(e.target.value); setTxPage(1); }}
            />
            <select
              className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25"
              value={txTypeFilter}
              onChange={(e) => { setTxTypeFilter(e.target.value); setTxPage(1); }}
            >
              <option value="">All types</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="DESTROY">DESTROY</option>
            </select>
            <div className="flex justify-end">
              <button
                className="btn-secondary-warm inline-flex h-11 items-center gap-2 rounded px-3 text-sm font-semibold"
                onClick={() => setShowAdvancedFilters((value) => !value)}
              >
                <Filter size={16} /> Filters {activeFilterCount ? `(${activeFilterCount})` : ""}
              </button>
            </div>
          </div>
        </div>
        {activeFilterCount ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[#6d5935]">Applied:</span>
            {txTypeFilter ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">Type: {txTypeFilter}</span> : null}
            {txWarehouseFilter ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">Warehouse</span> : null}
            {txFrom || txTo ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">Date range</span> : null}
            {txPageSize !== 20 ? <span className="rounded-full border border-[#ead6aa] bg-[#fff9ee] px-2 py-1 text-[#6d5935]">{txPageSize} / page</span> : null}
            <button className="text-xs font-semibold text-[#b35228] hover:underline" onClick={resetTransactionFilters}>Clear all</button>
          </div>
        ) : null}
        {showAdvancedFilters ? (
          <div className="mb-3 rounded-md border border-[#ead6aa] bg-[#fff4d9] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#2f2b20]">Advanced filters</div>
                <div className="text-xs text-muted-warm">Keep warehouse, date range and density filters here so the transaction table stays compact.</div>
              </div>
              <button className="btn-muted-warm h-9 rounded px-3 text-xs font-semibold" onClick={resetTransactionFilters}>Reset</button>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <select
                className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25"
                value={txWarehouseFilter}
                onChange={(e) => { setTxWarehouseFilter(e.target.value); setTxPage(1); }}
              >
                <option value="">All warehouses</option>
                {warehouseItems.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <Input type="date" value={txFrom} onChange={(e) => { setTxFrom(e.target.value); setTxPage(1); }} />
              <Input type="date" value={txTo} onChange={(e) => { setTxTo(e.target.value); setTxPage(1); }} />
              <select
                className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25"
                value={String(txPageSize)}
                onChange={(e) => { setTxPageSize(Number(e.target.value)); setTxPage(1); }}
              >
                <option value="10">10 / page</option>
                <option value="20">20 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
              </select>
            </div>
          </div>
        ) : null}
        <div className="overflow-auto">
          <table className="table-warm w-full min-w-[1160px] table-fixed text-sm">
            <colgroup>
              <col className="w-[120px]" />
              <col className="w-[200px]" />
              <col className="w-[100px]" />
              <col className="w-[220px]" />
              <col className="w-[180px]" />
              <col className="w-[180px]" />
              <col className="w-[220px]" />
              <col className="w-[200px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-left font-semibold">Reason</th>
                <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                <th className="px-3 py-2 text-left font-semibold">Warehouse</th>
                <th className="px-3 py-2 text-left font-semibold">Invoice</th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {tx.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-warm">Loading transactions...</td>
                </tr>
              ) : null}
              {txItems.map((t: any) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 align-middle">{t.type}</td>
                  <td className="truncate px-3 py-2 align-middle" title={t.product?.name}>{t.product?.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums align-middle">{t.quantity}</td>
                  <td className="truncate px-3 py-2 align-middle" title={t.reason ?? t.destroyReason ?? "-"}>{t.reason ?? t.destroyReason ?? "-"}</td>
                  <td className="truncate px-3 py-2 align-middle" title={t.supplierName ?? "-"}>{t.supplierName ?? "-"}</td>
                  <td className="truncate px-3 py-2 align-middle" title={t.warehouse?.name ?? "-"}>{t.warehouse?.name ?? "-"}</td>
                  <td className="truncate px-3 py-2 align-middle" title={t.invoiceNumber ?? "-"}>{t.invoiceNumber ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 align-middle">{t.createdAt ? new Date(t.createdAt).toLocaleString("en-US") : "-"}</td>
                </tr>
              ))}
              {!tx.isLoading && !txItems.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-warm">No inventory transactions yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-muted-warm">Total transactions: {txTotal}</div>
          <div className="flex items-center gap-2">
            <button className="btn-muted-warm h-9 rounded px-3 disabled:opacity-40" disabled={txPage <= 1} onClick={() => setTxPage((v) => Math.max(1, v - 1))}>
              Previous
            </button>
            <span>Page {txPage} / {txTotalPages}</span>
            <button className="btn-muted-warm h-9 rounded px-3 disabled:opacity-40" disabled={txPage >= txTotalPages} onClick={() => setTxPage((v) => Math.min(txTotalPages, v + 1))}>
              Next
            </button>
          </div>
        </div>
      </Card>
      {showTransactionModal ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#15371f]/45 p-4">
          <div className="surface-card w-full max-w-5xl overflow-hidden rounded-md border shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--color-border)] bg-[#f7ebd5] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#15371f]">Submit Transaction</h2>
                <p className="mt-1 text-sm text-muted-warm">Create inventory in, out, adjustment or destroy movement in one focused modal.</p>
              </div>
              <button
                className="btn-muted-warm grid h-9 w-9 place-items-center rounded"
                onClick={() => {
                  if (!mutate.isPending) setShowTransactionModal(false);
                }}
                aria-label="Close transaction modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[74vh] overflow-auto p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <select className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25" value={type} onChange={(e) => setType(e.target.value as any)}>
                  <option value="in">IN</option>
                  <option value="out">OUT</option>
                  <option value="adjustment">ADJUSTMENT</option>
                  <option value="destroy">DESTROY</option>
                </select>
                <select className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25" value={productId} onChange={(e) => setProductId(e.target.value)} disabled={products.isLoading || !!products.error}>
                  <option value="">{products.isLoading ? "Loading products..." : "Select product"}</option>
                  {productItems.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min={0} />
                <select className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={warehouses.isLoading || !!warehouses.error}>
                  <option value="">{warehouses.isLoading ? "Loading warehouses..." : "Warehouse (optional)"}</option>
                  {warehouseItems.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <select
                  className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Select reason</option>
                  {reasonItems.map((item) => (
                    <option key={item} value={item}>
                      {item.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>

                {type === "adjustment" ? (
                  <select className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25" value={adjustmentDirection} onChange={(e) => setAdjustmentDirection(e.target.value as "increase" | "decrease")}>
                    <option value="increase">Increase stock</option>
                    <option value="decrease">Decrease stock</option>
                  </select>
                ) : null}

                {type === "destroy" ? (
                  <select className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25" value={destroyReason} onChange={(e) => setDestroyReason(e.target.value)}>
                    <option value="DAMAGED">Damaged</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="CONTAMINATED">Contaminated</option>
                    <option value="OTHER">Other</option>
                  </select>
                ) : null}

                {type === "in" ? (
                  <>
                    <select className="field-warm h-11 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} disabled={suppliers.isLoading || !!suppliers.error}>
                      <option value="">{suppliers.isLoading ? "Loading suppliers..." : "Supplier name"}</option>
                      {supplierItems.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <Input placeholder="Delivered by (person name)" value={deliveredByName} onChange={(e) => setDeliveredByName(e.target.value)} />
                    <Input placeholder="Invoice number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                    <Input type="datetime-local" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} />
                  </>
                ) : null}
              </div>
              {mutationError ? <p className="mt-3 text-sm text-[#9c4326]">{mutationError}</p> : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[#f7ebd5] px-5 py-4">
              <button
                className="btn-muted-warm h-11 rounded px-4 text-sm font-semibold"
                onClick={() => setShowTransactionModal(false)}
                disabled={mutate.isPending}
              >
                Cancel
              </button>
              <Button disabled={!productId || mutate.isPending} onClick={() => mutate.mutate()}>
                {mutate.isPending ? "Submitting..." : "Submit Transaction"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
