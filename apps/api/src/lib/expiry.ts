type ExpiryStatus = "NORMAL" | "WARNING_15" | "ALERT_3" | "EXPIRED" | "DESTROYED";

export const computeExpiryStatus = (expiryDate: Date | null, destroyed = false): ExpiryStatus => {
  if (destroyed) return "DESTROYED";
  if (!expiryDate) return "NORMAL";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
  const days = Math.floor((target.getTime() - startOfToday.getTime()) / 86400000);
  if (days < 0) return "EXPIRED";
  if (days <= 3) return "ALERT_3";
  if (days <= 15) return "WARNING_15";
  return "NORMAL";
};
