import { prisma } from "../../lib/prisma.js";
const toJson = (value: unknown) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export const createAuditLog = async (input: {
  action: string; entity: string; entityId: string; userId: string; before?: unknown; after?: unknown;
}) => prisma.auditLog.create({
  data: {
    ...input,
    before: toJson(input.before) as any,
    after: toJson(input.after) as any,
  },
});
