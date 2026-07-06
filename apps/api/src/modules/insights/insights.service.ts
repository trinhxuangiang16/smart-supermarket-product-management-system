import { createHash } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { chatWithFallback } from "../ai/ai.service.js";

export type InsightTopic = "hr" | "inventory" | "strategy";

export type InsightResult = {
  topic: InsightTopic;
  summary: string;
  findings: string[];
  recommendations: string[];
  metrics: Record<string, unknown>;
  provider?: string;
  model?: string;
  cached: boolean;
  generatedAt: string;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const gatherHrData = async () => {
  const [departments, statusGroups, recentHires, total] = await Promise.all([
    prisma.department.findMany({
      include: { employees: { select: { salary: true, status: true } }, parent: { select: { name: true } } },
    }),
    prisma.employee.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.employee.count({ where: { hireDate: { gte: daysAgo(90) } } }),
    prisma.employee.count(),
  ]);
  const byDepartment = departments.map((d: any) => ({
    department: d.parent ? `${d.parent.name} / ${d.name}` : d.name,
    headcount: d.employees.length,
    totalSalary: d.employees.reduce((s: number, e: any) => s + Number(e.salary), 0),
    avgSalary: d.employees.length
      ? Number((d.employees.reduce((s: number, e: any) => s + Number(e.salary), 0) / d.employees.length).toFixed(2))
      : 0,
  }));
  return {
    totalEmployees: total,
    hiresLast90Days: recentHires,
    statusBreakdown: statusGroups.map((g: any) => ({ status: g.status, count: g._count._all })),
    byDepartment,
  };
};

const gatherInventoryData = async () => {
  const [productCount, expiryGroups, lowStock, destroyed, inOut, stockValueRows] = await Promise.all([
    prisma.product.count({ where: { isDeleted: false } }),
    prisma.product.groupBy({ by: ["expiryStatus"], where: { isDeleted: false }, _count: { _all: true } }),
    prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) c FROM Product WHERE isDeleted = 0 AND currentStock <= reorderLevel`
      .then((rows: { c: bigint }[]) => Number(rows[0]?.c ?? 0)),
    prisma.inventoryTransaction.aggregate({
      where: { type: "DESTROY", createdAt: { gte: daysAgo(90) } },
      _count: { _all: true },
      _sum: { totalValue: true },
    }),
    prisma.inventoryTransaction.groupBy({
      by: ["type"],
      where: { createdAt: { gte: daysAgo(30) } },
      _count: { _all: true },
      _sum: { totalValue: true },
    }),
    prisma.$queryRaw<{ category: string; stockValue: number }[]>`
      SELECT c.name AS category, SUM(p.currentStock * p.costPrice) AS stockValue
      FROM Product p JOIN Category c ON c.id = p.categoryId
      WHERE p.isDeleted = 0
      GROUP BY c.name ORDER BY stockValue DESC LIMIT 10`,
  ]);
  return {
    totalProducts: productCount,
    lowStockCount: Number(lowStock),
    expiryBreakdown: expiryGroups.map((g: any) => ({ status: g.expiryStatus, count: g._count._all })),
    destroyedLast90Days: { count: destroyed._count._all, value: Number(destroyed._sum.totalValue ?? 0) },
    transactionsLast30Days: inOut.map((g: any) => ({ type: g.type, count: g._count._all, value: Number(g._sum.totalValue ?? 0) })),
    topStockValueByCategory: stockValueRows.map((r: { category: string; stockValue: number }) => ({ category: r.category, stockValue: Number(r.stockValue) })),
  };
};

const gatherStrategyData = async () => {
  const [monthlyOut, topCategories, supplierCount, warehouseCount, employeeCount] = await Promise.all([
    prisma.$queryRaw<{ month: string; totalOut: number; txCount: bigint }[]>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, SUM(COALESCE(totalValue, 0)) AS totalOut, COUNT(*) AS txCount
      FROM InventoryTransaction WHERE type = 'OUT' AND createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month`,
    prisma.$queryRaw<{ category: string; outValue: number }[]>`
      SELECT c.name AS category, SUM(COALESCE(t.totalValue, 0)) AS outValue
      FROM InventoryTransaction t JOIN Product p ON p.id = t.productId JOIN Category c ON c.id = p.categoryId
      WHERE t.type = 'OUT' AND t.createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY c.name ORDER BY outValue DESC LIMIT 8`,
    prisma.supplier.count(),
    prisma.warehouse.count({ where: { isActive: true } }),
    prisma.employee.count(),
  ]);
  return {
    monthlySales: monthlyOut.map((r: { month: string; totalOut: number; txCount: bigint }) => ({ month: r.month, value: Number(r.totalOut), transactions: Number(r.txCount) })),
    topSellingCategories: topCategories.map((r: { category: string; outValue: number }) => ({ category: r.category, value: Number(r.outValue) })),
    supplierCount,
    activeWarehouses: warehouseCount,
    employeeCount,
  };
};

const topicPrompts: Record<InsightTopic, string> = {
  hr: "You are an HR analyst for a supermarket chain. Analyze headcount, salary cost by department, hiring pace, and status changes. Point out cost concentration, understaffed areas, and churn signals.",
  inventory: "You are an inventory analyst for a supermarket chain. Analyze stock levels, expiry risk, waste (destroyed goods), stock turnover, and stock value distribution. Point out waste hotspots and reorder risks.",
  strategy: "You are a business strategist for a supermarket chain. Analyze sales trends by month, top-selling categories, seasonality, and operational scale (suppliers, warehouses, staff). Propose concrete growth and margin actions.",
};

const gatherers: Record<InsightTopic, () => Promise<Record<string, unknown>>> = {
  hr: gatherHrData,
  inventory: gatherInventoryData,
  strategy: gatherStrategyData,
};

const extractJson = (raw: string): { summary?: unknown; findings?: unknown; recommendations?: unknown } | null => {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
};

const toStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).filter(Boolean) : [];

export const analyzeTopic = async (
  topic: InsightTopic,
  params: Record<string, unknown>,
  options?: { forceRefresh?: boolean },
): Promise<InsightResult> => {
  const metrics = await gatherers[topic]();
  // Cache key: topic + params + data snapshot + day, so results refresh when data or date changes
  const day = new Date().toISOString().slice(0, 10);
  const inputHash = createHash("sha256")
    .update(JSON.stringify({ params, metrics, day }))
    .digest("hex");

  if (!options?.forceRefresh) {
    const cached = await prisma.insightRun.findUnique({ where: { topic_inputHash: { topic, inputHash } } });
    if (cached) {
      return { ...(cached.resultJson as object), cached: true } as InsightResult;
    }
  }

  const chat = await chatWithFallback([
    {
      role: "system",
      content: `${topicPrompts[topic]}\nRespond with STRICT JSON only, no markdown, matching exactly: {"summary": string, "findings": string[], "recommendations": string[]}. Write in Vietnamese.`,
    },
    {
      role: "user",
      content: `Analysis parameters: ${JSON.stringify(params)}\nCurrent data (JSON): ${JSON.stringify(metrics)}`,
    },
  ]);

  const parsed = extractJson(chat.content);
  const result: InsightResult = {
    topic,
    summary: typeof parsed?.summary === "string" && parsed.summary ? parsed.summary : chat.content.trim(),
    findings: toStringArray(parsed?.findings),
    recommendations: toStringArray(parsed?.recommendations),
    metrics,
    provider: chat.provider,
    model: chat.model,
    cached: false,
    generatedAt: new Date().toISOString(),
  };

  await prisma.insightRun.upsert({
    where: { topic_inputHash: { topic, inputHash } },
    create: { topic, inputHash, resultJson: result as object },
    update: { resultJson: result as object },
  });

  return result;
};
