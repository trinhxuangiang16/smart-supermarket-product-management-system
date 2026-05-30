import { Router } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";
import { AuthRequest, requireAuth } from "../../middleware/require-auth.js";
import { getSystemSettings } from "../settings/settings.store.js";
import { createAuditLog } from "../audit/audit.service.js";
const router = Router();

const rangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const toDateRange = (q: unknown) => {
  const parsed = rangeSchema.safeParse(q);
  if (!parsed.success) return {};
  const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
  const to = parsed.data.to ? new Date(parsed.data.to) : undefined;
  if (!from && !to) return {};
  return { gte: from, lte: to };
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const shortDate = (value?: Date | string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US");
};

const dateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US");
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toCsv = (headers: string[], rows: Array<Array<string | number>>) => {
  const esc = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
};

const buildReportData = async (dateRange: any) => {
  const [systemSettings, products, destroyed, sold, recentTransactions] = await Promise.all([
    getSystemSettings(),
    prisma.product.findMany({
      where: { isDeleted: false },
      include: { category: true, supplier: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.inventoryTransaction.findMany({
      where: { type: "DESTROY", createdAt: dateRange },
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.inventoryTransaction.findMany({
      where: { type: "OUT", createdAt: dateRange },
      include: { product: { include: { category: true } } },
    }),
    prisma.inventoryTransaction.findMany({
      where: { createdAt: dateRange },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        performedBy: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const totalStockValue = products.reduce(
    (sum: number, p: any) => sum + Number(p.currentStock) * Number(p.costPrice),
    0,
  );
  const lowStock = products.filter((p: any) => Number(p.currentStock) <= Number(p.reorderLevel));
  const expiringSoon = products.filter((p: any) => ["ALERT_3", "WARNING_15"].includes(String(p.expiryStatus)));
  const expired = products.filter((p: any) => p.expiryStatus === "EXPIRED");
  const wasteTotal = destroyed.reduce((sum: number, t: any) => sum + Number(t.totalValue ?? 0), 0);

  const profitByCategory = new Map<string, { revenue: number; cost: number; qty: number }>();
  for (const t of sold) {
    const category = t.product.category.name;
    const qty = Number(t.quantity);
    const revenue = qty * Number(t.unitPrice ?? t.product.sellingPrice);
    const cost = qty * Number(t.product.costPrice);
    const prev = profitByCategory.get(category) ?? { revenue: 0, cost: 0, qty: 0 };
    profitByCategory.set(category, { revenue: prev.revenue + revenue, cost: prev.cost + cost, qty: prev.qty + qty });
  }

  const profitRows = Array.from(profitByCategory.entries())
    .map(([category, v]) => {
      const grossProfit = v.revenue - v.cost;
      return { category, qty: v.qty, revenue: v.revenue, cost: v.cost, grossProfit, margin: v.cost > 0 ? (grossProfit / v.cost) * 100 : 0 };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  return { systemSettings, products, destroyed, sold, recentTransactions, totalStockValue, lowStock, expiringSoon, expired, wasteTotal, profitRows };
};

router.get("/inventory-snapshot", requireAuth, async (req, res) => {
  const dateRange = toDateRange(req.query);
  const products = await prisma.product.findMany({
    where: { isDeleted: false },
    include: { category: true, supplier: true },
    orderBy: [{ currentStock: "asc" }, { name: "asc" }],
  });
  const totalStockValue = products.reduce(
    (sum: number, p: any) => sum + Number(p.currentStock) * Number(p.costPrice),
    0,
  );
  const lowStockCount = products.filter(
    (p: any) => Number(p.currentStock) <= Number(p.reorderLevel),
  ).length;
  const recentMovements = await prisma.inventoryTransaction.count({
    where: { createdAt: dateRange },
  });
  return res.json(
    ok({
      summary: {
        totalProducts: products.length,
        totalStockValue,
        lowStockCount,
        recentMovements,
      },
      items: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        supplier: p.supplier?.name ?? "-",
        currentStock: Number(p.currentStock),
        reorderLevel: Number(p.reorderLevel),
        costPrice: Number(p.costPrice),
        stockValue: Number(p.currentStock) * Number(p.costPrice),
        expiryStatus: p.expiryStatus,
      })),
    }),
  );
});

router.get("/waste-analysis", requireAuth, async (req, res) => {
  const dateRange = toDateRange(req.query);
  const destroyed = await prisma.inventoryTransaction.findMany({
    where: { type: "DESTROY", createdAt: dateRange },
    include: { product: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
  });
  const totalWasteValue = destroyed.reduce(
    (sum: number, t: any) => sum + Number(t.totalValue ?? 0),
    0,
  );
  const byCategoryMap = new Map<string, { quantity: number; value: number }>();
  for (const t of destroyed) {
    const key = t.product.category.name;
    const prev = byCategoryMap.get(key) ?? { quantity: 0, value: 0 };
    byCategoryMap.set(key, {
      quantity: prev.quantity + Number(t.quantity),
      value: prev.value + Number(t.totalValue ?? 0),
    });
  }
  return res.json(
    ok({
      summary: {
        destroyTransactions: destroyed.length,
        totalWasteValue,
      },
      byCategory: Array.from(byCategoryMap.entries()).map(([category, v]) => ({
        category,
        quantity: v.quantity,
        value: v.value,
      })),
      items: destroyed.map((t: any) => ({
        id: t.id,
        createdAt: t.createdAt,
        productName: t.product.name,
        category: t.product.category.name,
        quantity: Number(t.quantity),
        value: Number(t.totalValue ?? 0),
        destroyReason: t.destroyReason ?? "OTHER",
      })),
    }),
  );
});

router.get("/profit-by-category", requireAuth, async (req, res) => {
  const dateRange = toDateRange(req.query);
  const sold = await prisma.inventoryTransaction.findMany({
    where: { type: "OUT", createdAt: dateRange },
    include: { product: { include: { category: true } } },
  });
  const aggregate = new Map<
    string,
    { soldQuantity: number; revenue: number; cost: number }
  >();
  for (const t of sold) {
    const category = t.product.category.name;
    const qty = Number(t.quantity);
    const selling = Number(t.unitPrice ?? t.product.sellingPrice);
    const cost = Number(t.product.costPrice);
    const prev = aggregate.get(category) ?? { soldQuantity: 0, revenue: 0, cost: 0 };
    aggregate.set(category, {
      soldQuantity: prev.soldQuantity + qty,
      revenue: prev.revenue + qty * selling,
      cost: prev.cost + qty * cost,
    });
  }
  const rows = Array.from(aggregate.entries()).map(([category, v]) => {
    const grossProfit = v.revenue - v.cost;
    return {
      category,
      soldQuantity: v.soldQuantity,
      revenue: v.revenue,
      cost: v.cost,
      grossProfit,
      margin: v.cost > 0 ? (grossProfit / v.cost) * 100 : 0,
    };
  });
  return res.json(
    ok({
      summary: {
        totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
        totalCost: rows.reduce((s, r) => s + r.cost, 0),
        totalProfit: rows.reduce((s, r) => s + r.grossProfit, 0),
      },
      items: rows.sort((a, b) => b.grossProfit - a.grossProfit),
    }),
  );
});

router.get("/trends/transactions-daily", requireAuth, async (req, res) => {
  const parsed = z.object({ days: z.coerce.number().int().min(3).max(60).default(14) }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } });
  }
  const days = parsed.data.days;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const txs = await prisma.inventoryTransaction.findMany({
    where: { createdAt: { gte: start } },
    select: { type: true, createdAt: true, totalValue: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, { date: string; IN: number; OUT: number; ADJUSTMENT: number; DESTROY: number; totalValue: number }>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, IN: 0, OUT: 0, ADJUSTMENT: 0, DESTROY: 0, totalValue: 0 });
  }

  for (const tx of txs) {
    const key = tx.createdAt.toISOString().slice(0, 10);
    const row = byDay.get(key);
    if (!row) continue;
    const txType = tx.type as "IN" | "OUT" | "ADJUSTMENT" | "DESTROY";
    row[txType] += 1;
    row.totalValue += Number(tx.totalValue ?? 0);
  }

  return res.json(ok({ days, items: Array.from(byDay.values()) }));
});

router.get("/supplier-performance", requireAuth, async (req, res) => {
  const parsed = z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } });
  }
  const range = {
    ...(parsed.data.from ? { gte: new Date(`${parsed.data.from}T00:00:00.000Z`) } : {}),
    ...(parsed.data.to ? { lte: new Date(`${parsed.data.to}T23:59:59.999Z`) } : {}),
  };
  const createdAt = Object.keys(range).length ? range : undefined;

  const [suppliers, products, inTx, outTx, destroyTx] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { isDeleted: false },
      select: { id: true, supplierId: true, costPrice: true, sellingPrice: true },
    }),
    prisma.inventoryTransaction.findMany({
      where: { type: "IN", createdAt, supplierName: { not: null } },
      select: { supplierName: true, quantity: true, totalValue: true },
    }),
    prisma.inventoryTransaction.findMany({
      where: { type: "OUT", createdAt },
      select: { productId: true, quantity: true, totalValue: true, unitPrice: true },
    }),
    prisma.inventoryTransaction.findMany({
      where: { type: "DESTROY", createdAt },
      select: { productId: true, totalValue: true },
    }),
  ]);

  const productById = new Map<string, any>(products.map((p: any) => [p.id, p]));
  const resultMap = new Map<string, any>();

  for (const supplier of suppliers) {
    resultMap.set(supplier.name, {
      supplierId: supplier.id,
      supplierName: supplier.name,
      totalProducts: 0,
      inTransactions: 0,
      inQuantity: 0,
      inValue: 0,
      outRevenue: 0,
      outCostEstimate: 0,
      wasteValue: 0,
    });
  }

  for (const product of products) {
    if (!product.supplierId) continue;
    const supplier = suppliers.find((s: any) => s.id === product.supplierId);
    if (!supplier) continue;
    const row = resultMap.get(supplier.name);
    if (row) row.totalProducts += 1;
  }

  for (const tx of inTx) {
    const key = tx.supplierName ?? "";
    const row = resultMap.get(key);
    if (!row) continue;
    row.inTransactions += 1;
    row.inQuantity += Number(tx.quantity);
    row.inValue += Number(tx.totalValue ?? 0);
  }

  for (const tx of outTx) {
    const product = productById.get(tx.productId);
    if (!product?.supplierId) continue;
    const supplier = suppliers.find((s: any) => s.id === product.supplierId);
    if (!supplier) continue;
    const row = resultMap.get(supplier.name);
    if (!row) continue;
    const qty = Number(tx.quantity);
    row.outRevenue += Number(tx.totalValue ?? (Number(tx.unitPrice ?? product.sellingPrice) * qty));
    row.outCostEstimate += Number(product.costPrice) * qty;
  }

  for (const tx of destroyTx) {
    const product = productById.get(tx.productId);
    if (!product?.supplierId) continue;
    const supplier = suppliers.find((s: any) => s.id === product.supplierId);
    if (!supplier) continue;
    const row = resultMap.get(supplier.name);
    if (!row) continue;
    row.wasteValue += Number(tx.totalValue ?? 0);
  }

  const items = Array.from(resultMap.values()).map((row) => ({
    ...row,
    grossProfitEstimate: row.outRevenue - row.outCostEstimate,
    marginPercent: row.outCostEstimate > 0 ? ((row.outRevenue - row.outCostEstimate) / row.outCostEstimate) * 100 : 0,
  })).sort((a, b) => b.grossProfitEstimate - a.grossProfitEstimate);

  return res.json(ok({ items }));
});

router.get("/warehouse-overview", requireAuth, async (req, res) => {
  const parsed = z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } });
  }
  const range = {
    ...(parsed.data.from ? { gte: new Date(`${parsed.data.from}T00:00:00.000Z`) } : {}),
    ...(parsed.data.to ? { lte: new Date(`${parsed.data.to}T23:59:59.999Z`) } : {}),
  };
  const createdAt = Object.keys(range).length ? range : undefined;

  const [warehouses, txs] = await Promise.all([
    prisma.warehouse.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.inventoryTransaction.findMany({
      where: { createdAt },
      select: { type: true, warehouseId: true, quantity: true, totalValue: true },
    }),
  ]);

  const map = new Map<string, any>();
  for (const wh of warehouses) {
    map.set(wh.id, {
      warehouseId: wh.id,
      warehouseName: wh.name,
      warehouseCode: wh.code,
      isActive: wh.isActive,
      txCount: 0,
      inCount: 0,
      outCount: 0,
      adjustmentCount: 0,
      destroyCount: 0,
      inQty: 0,
      outQty: 0,
      adjustmentQty: 0,
      destroyQty: 0,
      movementValue: 0,
    });
  }

  const unassignedKey = "UNASSIGNED";
  map.set(unassignedKey, {
    warehouseId: unassignedKey,
    warehouseName: "Unassigned",
    warehouseCode: "-",
    isActive: true,
    txCount: 0,
    inCount: 0,
    outCount: 0,
    adjustmentCount: 0,
    destroyCount: 0,
    inQty: 0,
    outQty: 0,
    adjustmentQty: 0,
    destroyQty: 0,
    movementValue: 0,
  });

  for (const tx of txs) {
    const key = tx.warehouseId ?? unassignedKey;
    const row = map.get(key);
    if (!row) continue;
    row.txCount += 1;
    const qty = Number(tx.quantity);
    if (tx.type === "IN") {
      row.inCount += 1;
      row.inQty += qty;
    } else if (tx.type === "OUT") {
      row.outCount += 1;
      row.outQty += qty;
    } else if (tx.type === "ADJUSTMENT") {
      row.adjustmentCount += 1;
      row.adjustmentQty += qty;
    } else if (tx.type === "DESTROY") {
      row.destroyCount += 1;
      row.destroyQty += qty;
    }
    row.movementValue += Number(tx.totalValue ?? 0);
  }

  const items = Array.from(map.values()).sort((a, b) => b.txCount - a.txCount);
  return res.json(ok({ items }));
});

router.get("/inventory-snapshot.csv", requireAuth, async (req: AuthRequest, res) => {
  const dateRange = toDateRange(req.query);
  const products = await prisma.product.findMany({
    where: { isDeleted: false },
    include: { category: true, supplier: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  const recentInOut = await prisma.inventoryTransaction.findMany({
    where: { createdAt: dateRange, type: { in: ["IN", "OUT"] } },
    select: { productId: true, type: true, quantity: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const recentMap = new Map<string, { type: string; quantity: number; at: Date }>();
  for (const tx of recentInOut) {
    if (recentMap.has(tx.productId)) continue;
    recentMap.set(tx.productId, {
      type: tx.type,
      quantity: Number(tx.quantity),
      at: tx.createdAt,
    });
  }
  const csv = toCsv(
    [
      "product_name",
      "sku",
      "category",
      "supplier",
      "stock",
      "unit",
      "reorder_level",
      "cost_price",
      "selling_price",
      "stock_value",
      "profit_margin_percent",
      "expiry_status",
      "expiry_date",
      "last_movement_type",
      "last_movement_qty",
      "last_movement_at",
    ],
    products.map((p: any) => [
      p.name,
      p.sku,
      p.category.name,
      p.supplier?.name ?? "-",
      Number(p.currentStock),
      p.unit,
      Number(p.reorderLevel),
      Number(p.costPrice),
      Number(p.sellingPrice),
      Number(p.currentStock) * Number(p.costPrice),
      Number(p.profitMargin),
      p.expiryStatus,
      shortDate(p.expiryDate),
      recentMap.get(p.id)?.type ?? "-",
      recentMap.get(p.id)?.quantity ?? "-",
      recentMap.get(p.id)?.at ? dateTime(recentMap.get(p.id)?.at) : "-",
    ]),
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="inventory-snapshot.csv"');
  await createAuditLog({
    action: "REPORT_EXPORT_CSV",
    entity: "Report",
    entityId: "inventory-snapshot",
    userId: req.user!.id,
    after: { format: "csv", report: "inventory-snapshot", query: req.query },
  });
  res.send(csv);
});

router.get("/inventory-snapshot.xlsx", requireAuth, async (req: AuthRequest, res) => {
  const dateRange = toDateRange(req.query);
  const products = await prisma.product.findMany({
    where: { isDeleted: false },
    include: { category: true, supplier: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  const recentInOut = await prisma.inventoryTransaction.findMany({
    where: { createdAt: dateRange, type: { in: ["IN", "OUT"] } },
    select: { productId: true, type: true, quantity: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const recentMap = new Map<string, { type: string; quantity: number; at: Date }>();
  for (const tx of recentInOut) {
    if (recentMap.has(tx.productId)) continue;
    recentMap.set(tx.productId, { type: tx.type, quantity: Number(tx.quantity), at: tx.createdAt });
  }

  const rows = products.map((p: any) => ({
    product_name: p.name,
    sku: p.sku,
    category: p.category.name,
    supplier: p.supplier?.name ?? "-",
    stock: Number(p.currentStock),
    unit: p.unit,
    reorder_level: Number(p.reorderLevel),
    cost_price: Number(p.costPrice),
    selling_price: Number(p.sellingPrice),
    stock_value: Number(p.currentStock) * Number(p.costPrice),
    profit_margin_percent: Number(p.profitMargin),
    expiry_status: p.expiryStatus,
    expiry_date: shortDate(p.expiryDate),
    last_movement_type: recentMap.get(p.id)?.type ?? "-",
    last_movement_qty: recentMap.get(p.id)?.quantity ?? "-",
    last_movement_at: recentMap.get(p.id)?.at ? dateTime(recentMap.get(p.id)?.at) : "-",
  }));
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Snapshot");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="inventory-snapshot.xlsx"');
  await createAuditLog({
    action: "REPORT_EXPORT_XLSX",
    entity: "Report",
    entityId: "inventory-snapshot",
    userId: req.user!.id,
    after: { format: "xlsx", report: "inventory-snapshot", query: req.query },
  });
  res.send(buffer);
});

router.get("/management-report.html", requireAuth, async (req: AuthRequest, res) => {
  const dateRange = toDateRange(req.query);
  const { systemSettings, products, destroyed, recentTransactions, totalStockValue, lowStock, expiringSoon, expired, wasteTotal, profitRows } = await buildReportData(dateRange);

  const generatedAt = new Date();
  const rangeInfo = `${shortDate((dateRange as any)?.gte)} - ${shortDate((dateRange as any)?.lte)}`;
  const storeName = systemSettings.profile.storeName || "Smart Supermarket";
  const branchName = systemSettings.profile.branchName || "Main Branch";
  const preparedBy = systemSettings.reports.preparedBy || "Operations Manager";
  const footerNote = systemSettings.reports.footerNote || "Generated by Smart Supermarket Product Management System.";
  const contactParts = [
    systemSettings.profile.address,
    systemSettings.profile.contactPhone ? `Phone: ${systemSettings.profile.contactPhone}` : "",
    systemSettings.profile.contactEmail ? `Email: ${systemSettings.profile.contactEmail}` : "",
    systemSettings.profile.taxCode ? `Tax Code: ${systemSettings.profile.taxCode}` : "",
  ].filter(Boolean);
  const contactLine = systemSettings.reports.includeContactInExport ? contactParts.join(" | ") : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Smart Supermarket Management Report</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; }
    .page { max-width: 1180px; margin: 0 auto; padding: 24px; }
    .header { background: #0f172a; color: #fff; padding: 18px 22px; border-radius: 10px; }
    .muted { color: #64748b; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
    .kpi { font-size: 20px; font-weight: 700; margin-top: 4px; }
    h2 { font-size: 16px; margin: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border: 1px solid #e2e8f0; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .section { margin-top: 16px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .b-red { background: #fee2e2; color: #b91c1c; }
    .b-amber { background: #fef3c7; color: #b45309; }
    .b-green { background: #dcfce7; color: #166534; }
    .footer { margin-top: 14px; font-size: 12px; color: #64748b; }
    @media print { body { background: #fff; } .page { max-width: none; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div style="font-size:22px;font-weight:700;">${escapeHtml(storeName)} - Management Report</div>
      <div class="muted" style="color:#cbd5e1;margin-top:4px;">${escapeHtml(branchName)}</div>
      <div class="muted" style="color:#cbd5e1;margin-top:6px;">Generated at: ${escapeHtml(dateTime(generatedAt))} | Range: ${escapeHtml(rangeInfo)}</div>
      ${contactLine ? `<div class="muted" style="color:#cbd5e1;margin-top:6px;">${escapeHtml(contactLine)}</div>` : ""}
    </div>

    <div class="grid">
      <div class="card"><div class="muted">Total Products</div><div class="kpi">${escapeHtml(products.length)}</div></div>
      <div class="card"><div class="muted">Total Stock Value</div><div class="kpi">${escapeHtml(money(totalStockValue))}</div></div>
      <div class="card"><div class="muted">Low Stock Items</div><div class="kpi">${escapeHtml(lowStock.length)}</div></div>
      <div class="card"><div class="muted">Waste Value</div><div class="kpi">${escapeHtml(money(wasteTotal))}</div></div>
    </div>

    <div class="section card">
      <h2>Inventory Health Summary</h2>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">
        <div><span class="badge b-amber">Expiring Soon</span> ${escapeHtml(expiringSoon.length)} items</div>
        <div><span class="badge b-red">Expired</span> ${escapeHtml(expired.length)} items</div>
        <div><span class="badge b-green">Healthy</span> ${escapeHtml(products.length - expiringSoon.length - expired.length)} items</div>
      </div>
    </div>

    <div class="section">
      <h2>Profit by Category</h2>
      <table>
        <thead><tr><th>Category</th><th>Sold Qty</th><th>Revenue</th><th>Cost</th><th>Gross Profit</th><th>Margin %</th></tr></thead>
        <tbody>
          ${profitRows.map((row) => `<tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.qty.toFixed(3))}</td>
            <td>${escapeHtml(money(row.revenue))}</td>
            <td>${escapeHtml(money(row.cost))}</td>
            <td>${escapeHtml(money(row.grossProfit))}</td>
            <td>${escapeHtml(row.margin.toFixed(2))}%</td>
          </tr>`).join("") || '<tr><td colspan="6" class="muted">No sales in selected range.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Low Stock Products (Top 20)</h2>
      <table>
        <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Supplier</th><th>Stock</th><th>Reorder</th><th>Expiry</th></tr></thead>
        <tbody>
          ${lowStock
            .sort((a: any, b: any) => Number(a.currentStock) - Number(b.currentStock))
            .slice(0, 20)
            .map((p: any) => `<tr>
              <td>${escapeHtml(p.name)}</td>
              <td>${escapeHtml(p.sku)}</td>
              <td>${escapeHtml(p.category.name)}</td>
              <td>${escapeHtml(p.supplier?.name ?? "-")}</td>
              <td>${escapeHtml(Number(p.currentStock).toFixed(3))} ${escapeHtml(p.unit)}</td>
              <td>${escapeHtml(Number(p.reorderLevel).toFixed(3))}</td>
              <td>${escapeHtml(p.expiryStatus)} (${escapeHtml(shortDate(p.expiryDate))})</td>
            </tr>`).join("") || '<tr><td colspan="7" class="muted">No low stock products.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Recent Inventory Movements (Top 20)</h2>
      <table>
        <thead><tr><th>Time</th><th>Type</th><th>Product</th><th>Qty</th><th>Actor</th><th>Role</th><th>Reason/Invoice</th></tr></thead>
        <tbody>
          ${recentTransactions.map((tx: any) => `<tr>
            <td>${escapeHtml(dateTime(tx.createdAt))}</td>
            <td>${escapeHtml(tx.type)}</td>
            <td>${escapeHtml(tx.product?.name ?? "-")} (${escapeHtml(tx.product?.sku ?? "-")})</td>
            <td>${escapeHtml(Number(tx.quantity).toFixed(3))} ${escapeHtml(tx.product?.unit ?? "")}</td>
            <td>${escapeHtml(tx.performedBy?.name ?? tx.performedBy?.email ?? "-")}</td>
            <td>${escapeHtml(tx.performedBy?.role ?? "-")}</td>
            <td>${escapeHtml(tx.reason ?? tx.destroyReason ?? tx.invoiceNumber ?? "-")}</td>
          </tr>`).join("") || '<tr><td colspan="7" class="muted">No transaction data.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Waste Analysis (Top 20 Destroy Transactions)</h2>
      <table>
        <thead><tr><th>Date</th><th>Product</th><th>Category</th><th>Qty</th><th>Reason</th><th>Value</th></tr></thead>
        <tbody>
          ${destroyed.map((t: any) => `<tr>
            <td>${escapeHtml(shortDate(t.createdAt))}</td>
            <td>${escapeHtml(t.product?.name ?? "-")}</td>
            <td>${escapeHtml(t.product?.category?.name ?? "-")}</td>
            <td>${escapeHtml(Number(t.quantity).toFixed(3))}</td>
            <td>${escapeHtml(t.destroyReason ?? "OTHER")}</td>
            <td>${escapeHtml(money(Number(t.totalValue ?? 0)))}</td>
          </tr>`).join("") || '<tr><td colspan="6" class="muted">No destroy transactions.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="footer">${escapeHtml(footerNote)} Prepared by: ${escapeHtml(preparedBy)}. Tip: open this file in browser and press Ctrl+P to save as PDF for sharing.</div>
  </div>
</body>
</html>`;

  const safeFrom = (req.query as any)?.from ? String((req.query as any).from).replaceAll("/", "-") : "all";
  const safeTo = (req.query as any)?.to ? String((req.query as any).to).replaceAll("/", "-") : "all";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="management-report-${safeFrom}-to-${safeTo}.html"`);
  await createAuditLog({
    action: "REPORT_EXPORT_HTML",
    entity: "Report",
    entityId: "management-report",
    userId: req.user!.id,
    after: { format: "html", report: "management-report", query: req.query },
  });
  res.send(html);
});

router.get("/management-report.pdf", requireAuth, async (req: AuthRequest, res) => {
  const dateRange = toDateRange(req.query);
  const { systemSettings, products, destroyed, recentTransactions, totalStockValue, lowStock, expiringSoon, expired, wasteTotal, profitRows } = await buildReportData(dateRange);

  const generatedAt = new Date();
  const rangeInfo = `${shortDate((dateRange as any)?.gte)} - ${shortDate((dateRange as any)?.lte)}`;
  const storeName = systemSettings.profile.storeName || "Smart Supermarket";
  const branchName = systemSettings.profile.branchName || "Main Branch";
  const preparedBy = systemSettings.reports.preparedBy || "Operations Manager";

  const safeFrom = (req.query as any)?.from ? String((req.query as any).from).replaceAll("/", "-") : "all";
  const safeTo = (req.query as any)?.to ? String((req.query as any).to).replaceAll("/", "-") : "all";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="management-report-${safeFrom}-to-${safeTo}.pdf"`);

  const doc = new PDFDocument({ size: "A4", margin: 42 });
  doc.pipe(res);

  doc.fontSize(18).text(`${storeName} - Management Report`, { align: "left" });
  doc.moveDown(0.2);
  doc.fontSize(11).fillColor("#475569").text(`${branchName}`);
  doc.text(`Generated: ${dateTime(generatedAt)} | Range: ${rangeInfo}`);
  doc.text(`Prepared by: ${preparedBy}`);
  doc.fillColor("#0f172a");
  doc.moveDown(0.8);

  doc.fontSize(12).text("Summary", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10)
    .text(`Total Products: ${products.length}`)
    .text(`Total Stock Value: ${money(totalStockValue)}`)
    .text(`Low Stock Items: ${lowStock.length}`)
    .text(`Waste Value: ${money(wasteTotal)}`)
    .text(`Expiring Soon: ${expiringSoon.length}`)
    .text(`Expired: ${expired.length}`);

  doc.moveDown(0.8);
  doc.fontSize(12).text("Profit by Category (Top 12)", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9);
  for (const row of profitRows.slice(0, 12)) {
    doc.text(`${row.category}: Qty ${row.qty.toFixed(3)} | Revenue ${money(row.revenue)} | Cost ${money(row.cost)} | Profit ${money(row.grossProfit)} | Margin ${row.margin.toFixed(2)}%`);
  }
  if (!profitRows.length) doc.text("No sales in selected range.");

  doc.moveDown(0.8);
  doc.fontSize(12).text("Low Stock Products (Top 15)", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9);
  for (const p of lowStock.sort((a: any, b: any) => Number(a.currentStock) - Number(b.currentStock)).slice(0, 15)) {
    doc.text(`${p.name} (${p.sku}) | Stock ${Number(p.currentStock).toFixed(3)} ${p.unit} | Reorder ${Number(p.reorderLevel).toFixed(3)} | ${p.expiryStatus}`);
  }
  if (!lowStock.length) doc.text("No low stock products.");

  doc.addPage();
  doc.fontSize(12).text("Recent Inventory Movements (Top 20)", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9);
  for (const tx of recentTransactions.slice(0, 20)) {
    doc.text(`${dateTime(tx.createdAt)} | ${tx.type} | ${tx.product?.name ?? "-"} (${tx.product?.sku ?? "-"}) | Qty ${Number(tx.quantity).toFixed(3)} ${tx.product?.unit ?? ""} | ${tx.performedBy?.name ?? tx.performedBy?.email ?? "-"}`);
  }
  if (!recentTransactions.length) doc.text("No transaction data.");

  doc.moveDown(0.8);
  doc.fontSize(12).text("Waste Analysis (Top 20)", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9);
  for (const t of destroyed.slice(0, 20)) {
    doc.text(`${shortDate(t.createdAt)} | ${t.product?.name ?? "-"} | ${t.product?.category?.name ?? "-"} | Qty ${Number(t.quantity).toFixed(3)} | ${t.destroyReason ?? "OTHER"} | ${money(Number(t.totalValue ?? 0))}`);
  }
  if (!destroyed.length) doc.text("No destroy transactions.");

  doc.moveDown(0.8);
  doc.fontSize(9).fillColor("#64748b").text(systemSettings.reports.footerNote || "Generated by Smart Supermarket Product Management System.");

  await createAuditLog({
    action: "REPORT_EXPORT_PDF",
    entity: "Report",
    entityId: "management-report",
    userId: req.user!.id,
    after: { format: "pdf", report: "management-report", query: req.query },
  });
  doc.end();
});
export default router;
