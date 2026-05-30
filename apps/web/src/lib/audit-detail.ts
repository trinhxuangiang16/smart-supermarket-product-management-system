type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const titleCase = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const actionLabel = (action?: string | null) => {
  if (!action) return "Unknown action";
  return titleCase(action);
};

export const actorLabel = (row: any) =>
  row?.user?.name ?? row?.user?.email ?? "Unknown user";

export const targetLabel = (row: any) =>
  row?.after?.name
  ?? row?.before?.name
  ?? row?.after?.sku
  ?? row?.before?.sku
  ?? row?.entityId
  ?? "-";

export const describeActivity = (row: any) => {
  const actor = actorLabel(row);
  const action = row?.action ?? "";
  const target = targetLabel(row);

  if (action === "USER_UPDATE") {
    const beforeRole = row?.before?.role;
    const afterRole = row?.after?.role;
    const beforeName = row?.before?.name;
    const afterName = row?.after?.name;
    if (beforeRole && afterRole && beforeRole !== afterRole) {
      return `${actor} changed role of ${target} from ${beforeRole} to ${afterRole}.`;
    }
    if (beforeName && afterName && beforeName !== afterName) {
      return `${actor} changed user name from ${beforeName} to ${afterName}.`;
    }
    return `${actor} updated user ${target}.`;
  }

  if (action === "USER_CREATE") return `${actor} created user ${target}.`;
  if (action === "USER_DELETE") return `${actor} deleted user ${target}.`;
  if (action === "USER_PASSWORD_RESET") return `${actor} reset password for ${target}.`;
  if (action === "USER_PASSWORD_CHANGE_SELF") return `${actor} changed own password.`;
  if (action === "AUTH_LOGIN") return `${actor} logged in and created a session.`;
  if (action === "AUTH_REFRESH") return `${actor} refreshed login session.`;
  if (action === "AUTH_LOGOUT") return `${actor} logged out and revoked session.`;
  if (action === "AUTH_SESSION_REVOKE") return `${actor} revoked a device session.`;
  if (action === "AUTH_SESSION_REVOKE_OTHERS") return `${actor} revoked all other device sessions.`;
  if (action === "APPROVAL_REQUEST_CREATE") return `${actor} submitted approval request for ${target}.`;
  if (action.endsWith("_APPROVED")) return `${actor} approved ${target}.`;
  if (action.includes("REJECT")) return `${actor} rejected request for ${target}.`;
  if (action === "INVENTORY_IN") return `${actor} added stock for ${target}.`;
  if (action === "INVENTORY_OUT") return `${actor} removed stock for ${target}.`;
  if (action === "INVENTORY_ADJUSTMENT") return `${actor} adjusted stock for ${target}.`;
  if (action === "INVENTORY_DESTROY") return `${actor} destroyed stock for ${target}.`;
  if (action === "WAREHOUSE_CREATE") return `${actor} created a warehouse.`;
  if (action === "WAREHOUSE_UPDATE") return `${actor} updated warehouse ${target}.`;
  if (action === "WAREHOUSE_DELETE") return `${actor} deleted warehouse ${target}.`;
  if (action === "REPORT_EXPORT_CSV") return `${actor} exported CSV report.`;
  if (action === "REPORT_EXPORT_XLSX") return `${actor} exported XLSX report.`;
  if (action === "REPORT_EXPORT_HTML") return `${actor} exported HTML report.`;
  if (action === "REPORT_EXPORT_PDF") return `${actor} exported PDF report.`;

  return `${actor} performed ${actionLabel(action).toLowerCase()} on ${target}.`;
};

export type FieldDiff = {
  field: string;
  label: string;
  before: string;
  after: string;
};

const fieldLabelMap: Record<string, string> = {
  role: "Role",
  name: "Name",
  email: "Email",
  sku: "SKU",
  barcode: "Barcode",
  categoryId: "Category",
  supplierId: "Supplier",
  costPrice: "Cost Price",
  sellingPrice: "Selling Price",
  currentStock: "Current Stock",
  reorderLevel: "Reorder Level",
  expiryDate: "Expiry Date",
  productionDate: "Production Date",
  approvedById: "Approved By",
  requestedById: "Requested By",
  status: "Status",
  notes: "Notes",
  reviewNote: "Review Note",
};

const formatFieldLabel = (field: string) => fieldLabelMap[field] ?? titleCase(field);

const formatDisplayValue = (value: unknown): string => {
  const raw = stringifyValue(value);
  if (raw === "-" || raw === "null") return "-";
  if (typeof value === "string") {
    const isoDate = /^\d{4}-\d{2}-\d{2}T/.test(value);
    if (isoDate) return new Date(value).toLocaleString("en-US");
  }
  return raw.length > 90 ? `${raw.slice(0, 90)}...` : raw;
};

export const buildFieldDiffs = (beforeValue: unknown, afterValue: unknown): FieldDiff[] => {
  const before = isRecord(beforeValue) ? beforeValue : {};
  const after = isRecord(afterValue) ? afterValue : {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return keys
    .filter((key) => stringifyValue(before[key]) !== stringifyValue(after[key]))
    .map((key) => ({
      field: key,
      label: formatFieldLabel(key),
      before: formatDisplayValue(before[key]),
      after: formatDisplayValue(after[key]),
    }));
};
