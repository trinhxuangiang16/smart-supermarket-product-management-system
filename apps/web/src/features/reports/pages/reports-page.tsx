import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getToken } from "../../../lib/api-client";
import { Button, Card, Input } from "../../../components/ui/basic";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export const ReportsPage = () => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exportError, setExportError] = useState("");
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString() ? `?${p.toString()}` : "";
  }, [from, to]);

  const inventory = useQuery({
    queryKey: ["report-inventory", query],
    queryFn: () => api<any>(`/reports/inventory-snapshot${query}`),
  });
  const waste = useQuery({
    queryKey: ["report-waste", query],
    queryFn: () => api<any>(`/reports/waste-analysis${query}`),
  });
  const profit = useQuery({
    queryKey: ["report-profit", query],
    queryFn: () => api<any>(`/reports/profit-by-category${query}`),
  });

  const downloadFile = async (url: string, filename: string) => {
    setExportError("");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    if (!response.ok) {
      setExportError("Export failed. Please try again.");
      return;
    }
    const blob = await response.blob();
    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(fileUrl);
  };

  const exportInventoryCsv = async () => {
    await downloadFile(
      `http://localhost:4000/api/reports/inventory-snapshot.csv${query}`,
      "inventory-snapshot.csv",
    );
  };
  const exportInventoryXlsx = async () => {
    await downloadFile(
      `http://localhost:4000/api/reports/inventory-snapshot.xlsx${query}`,
      "inventory-snapshot.xlsx",
    );
  };

  const exportManagementReport = async () => {
    await downloadFile(
      `http://localhost:4000/api/reports/management-report.html${query}`,
      "management-report.html",
    );
  };

  const exportManagementPdf = async () => {
    await downloadFile(
      `http://localhost:4000/api/reports/management-report.pdf${query}`,
      "management-report.pdf",
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto_auto_auto]">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={exportInventoryCsv}>Export CSV</Button>
          <Button className="bg-indigo-700 hover:bg-indigo-600" onClick={exportInventoryXlsx}>
            Export XLSX
          </Button>
          <Button className="bg-blue-700 hover:bg-blue-600" onClick={exportManagementPdf}>
            Export PDF
          </Button>
          <Button className="bg-emerald-700 hover:bg-emerald-600" onClick={exportManagementReport}>
            Export Friendly Report
          </Button>
        </div>
        {exportError ? <p className="mt-2 text-sm text-red-600">{exportError}</p> : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="text-xs text-slate-500">Inventory Stock Value</div>
          <div className="text-lg font-semibold">
            {currency.format(inventory.data?.data?.summary?.totalStockValue ?? 0)}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Waste Value</div>
          <div className="text-lg font-semibold text-red-600">
            {currency.format(waste.data?.data?.summary?.totalWasteValue ?? 0)}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Gross Profit</div>
          <div className="text-lg font-semibold text-emerald-600">
            {currency.format(profit.data?.data?.summary?.totalProfit ?? 0)}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-semibold">Profit by Category</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Category</th>
                <th className="text-left">Revenue</th>
                <th className="text-left">Cost</th>
                <th className="text-left">Profit</th>
                <th className="text-left">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {(profit.data?.data?.items ?? []).map((row: any) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>{currency.format(row.revenue)}</td>
                  <td>{currency.format(row.cost)}</td>
                  <td>{currency.format(row.grossProfit)}</td>
                  <td>{row.margin.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Waste Analysis</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-left">Product</th>
                <th className="text-left">Category</th>
                <th className="text-left">Reason</th>
                <th className="text-left">Value</th>
              </tr>
            </thead>
            <tbody>
              {(waste.data?.data?.items ?? []).slice(0, 20).map((row: any) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleDateString("en-US")}</td>
                  <td>{row.productName}</td>
                  <td>{row.category}</td>
                  <td>{row.destroyReason}</td>
                  <td>{currency.format(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
