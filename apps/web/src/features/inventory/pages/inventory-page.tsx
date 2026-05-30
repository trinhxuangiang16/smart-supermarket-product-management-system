import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [deliveredByName, setDeliveredByName] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");
  const [txFrom, setTxFrom] = useState("");
  const [txTo, setTxTo] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);

  const products = useQuery({
    queryKey: ["inventory-products"],
    queryFn: () => api<any>("/products?page=1&pageSize=100"),
  });
  const suppliers = useQuery({
    queryKey: ["inventory-suppliers"],
    queryFn: () => api<any>("/suppliers"),
  });
  const txQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(txPage));
    params.set("pageSize", String(txPageSize));
    if (txTypeFilter) params.set("type", txTypeFilter);
    if (txSearch.trim()) params.set("search", txSearch.trim());
    if (txFrom) params.set("from", txFrom);
    if (txTo) params.set("to", txTo);
    return params.toString();
  }, [txPage, txPageSize, txTypeFilter, txSearch, txFrom, txTo]);
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
      setDeliveredByName("");
      setDeliveredAt("");
      setDestroyReason("DAMAGED");
      setAdjustmentDirection("increase");
      qc.invalidateQueries({ queryKey: ["inventory-transactions"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => setMutationError((err as Error).message),
  });

  const productItems = readItems(products.data?.data);
  const supplierItems = readItems(suppliers.data?.data);
  const txItems = readItems(tx.data?.data);
  const txTotal = Number(tx.data?.data?.total ?? 0);
  const txTotalPages = Math.max(1, Math.ceil(txTotal / txPageSize));
  const queryError = (products.error ?? suppliers.error ?? tx.error) as Error | null;

  return (
    <div className="space-y-4">
      <Card>
        {queryError ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-sm text-red-700">{queryError.message}</p>
            <button
              className="h-8 rounded border border-red-300 px-3 text-xs text-red-700 hover:bg-red-100"
              onClick={() => {
                products.refetch();
                suppliers.refetch();
                tx.refetch();
              }}
            >
              Retry
            </button>
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-4">
          <select className="h-11 rounded border px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="in">IN</option>
            <option value="out">OUT</option>
            <option value="adjustment">ADJUSTMENT</option>
            <option value="destroy">DESTROY</option>
          </select>
          <select className="h-11 rounded border px-3 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)} disabled={products.isLoading || !!products.error}>
            <option value="">{products.isLoading ? "Loading products..." : "Select product"}</option>
            {productItems.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min={0} />
          <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />

          {type === "adjustment" ? (
            <select className="h-11 rounded border px-3 text-sm" value={adjustmentDirection} onChange={(e) => setAdjustmentDirection(e.target.value as "increase" | "decrease")}>
              <option value="increase">Increase stock</option>
              <option value="decrease">Decrease stock</option>
            </select>
          ) : null}

          {type === "destroy" ? (
            <select className="h-11 rounded border px-3 text-sm" value={destroyReason} onChange={(e) => setDestroyReason(e.target.value)}>
              <option value="DAMAGED">Damaged</option>
              <option value="EXPIRED">Expired</option>
              <option value="CONTAMINATED">Contaminated</option>
              <option value="OTHER">Other</option>
            </select>
          ) : null}

          {type === "in" ? (
            <>
              <select className="h-11 rounded border px-3 text-sm" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} disabled={suppliers.isLoading || !!suppliers.error}>
                <option value="">{suppliers.isLoading ? "Loading suppliers..." : "Supplier name"}</option>
                {supplierItems.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <Input placeholder="Delivered by (person name)" value={deliveredByName} onChange={(e) => setDeliveredByName(e.target.value)} />
              <Input placeholder="Invoice number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              <Input type="datetime-local" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} />
            </>
          ) : null}
        </div>
        {mutationError ? <p className="mt-3 text-sm text-red-600">{mutationError}</p> : null}
        <div className="mt-3">
          <Button disabled={!productId || mutate.isPending} onClick={() => mutate.mutate()}>{mutate.isPending ? "Submitting..." : "Submit Transaction"}</Button>
        </div>
      </Card>

      <Card>
        <div className="mb-3 grid gap-2 md:grid-cols-5">
          <Input
            placeholder="Search transaction..."
            value={txSearch}
            onChange={(e) => { setTxSearch(e.target.value); setTxPage(1); }}
          />
          <select
            className="h-11 rounded border px-3 text-sm"
            value={txTypeFilter}
            onChange={(e) => { setTxTypeFilter(e.target.value); setTxPage(1); }}
          >
            <option value="">All types</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
            <option value="DESTROY">DESTROY</option>
          </select>
          <Input type="date" value={txFrom} onChange={(e) => { setTxFrom(e.target.value); setTxPage(1); }} />
          <Input type="date" value={txTo} onChange={(e) => { setTxTo(e.target.value); setTxPage(1); }} />
          <select
            className="h-11 rounded border px-3 text-sm"
            value={String(txPageSize)}
            onChange={(e) => { setTxPageSize(Number(e.target.value)); setTxPage(1); }}
          >
            <option value="10">10 / page</option>
            <option value="20">20 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1040px] table-fixed text-sm">
            <colgroup>
              <col className="w-[120px]" />
              <col className="w-[200px]" />
              <col className="w-[100px]" />
              <col className="w-[220px]" />
              <col className="w-[180px]" />
              <col className="w-[220px]" />
              <col className="w-[200px]" />
            </colgroup>
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-left font-semibold">Reason</th>
                <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                <th className="px-3 py-2 text-left font-semibold">Invoice</th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {tx.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Loading transactions...</td>
                </tr>
              ) : null}
              {txItems.map((t: any) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-3 py-2 align-middle">{t.type}</td>
                  <td className="truncate px-3 py-2 align-middle" title={t.product?.name}>{t.product?.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums align-middle">{t.quantity}</td>
                  <td className="truncate px-3 py-2 align-middle" title={t.reason ?? t.destroyReason ?? "-"}>{t.reason ?? t.destroyReason ?? "-"}</td>
                  <td className="truncate px-3 py-2 align-middle" title={t.supplierName ?? "-"}>{t.supplierName ?? "-"}</td>
                  <td className="truncate px-3 py-2 align-middle" title={t.invoiceNumber ?? "-"}>{t.invoiceNumber ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 align-middle">{t.createdAt ? new Date(t.createdAt).toLocaleString("en-US") : "-"}</td>
                </tr>
              ))}
              {!tx.isLoading && !txItems.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">No inventory transactions yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-slate-500">Total transactions: {txTotal}</div>
          <div className="flex items-center gap-2">
            <button className="h-9 rounded border px-3 disabled:opacity-40" disabled={txPage <= 1} onClick={() => setTxPage((v) => Math.max(1, v - 1))}>
              Previous
            </button>
            <span>Page {txPage} / {txTotalPages}</span>
            <button className="h-9 rounded border px-3 disabled:opacity-40" disabled={txPage >= txTotalPages} onClick={() => setTxPage((v) => Math.min(txTotalPages, v + 1))}>
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
