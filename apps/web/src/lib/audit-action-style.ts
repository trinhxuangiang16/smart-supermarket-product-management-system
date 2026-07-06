type AuditActionKind = "create" | "update" | "delete" | "auth" | "other";

const classifyAction = (action?: string): AuditActionKind => {
  const a = (action ?? "").toUpperCase();
  if (a.includes("DELETE") || a.includes("DESTROY") || a.includes("REVOKE")) return "delete";
  if (a.includes("CREATE") || a.includes("IN") || a.includes("REGISTER") || a.includes("IMPORT")) return "create";
  if (a.includes("UPDATE") || a.includes("ADJUST") || a.includes("APPROVE") || a.includes("CHANGE")) return "update";
  if (a.includes("LOGIN") || a.includes("LOGOUT") || a.includes("SESSION")) return "auth";
  return "other";
};

const badgeClasses: Record<AuditActionKind, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-amber-100 text-amber-700",
  delete: "bg-red-100 text-red-700",
  auth: "bg-sky-100 text-sky-700",
  other: "bg-slate-200 text-slate-700",
};

const buttonClasses: Record<AuditActionKind, string> = {
  create: "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  update: "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
  delete: "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
  auth: "border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100",
  other: "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100",
};

export const auditActionBadgeClass = (action?: string) => badgeClasses[classifyAction(action)];
export const auditActionButtonClass = (action?: string) => buttonClasses[classifyAction(action)];
