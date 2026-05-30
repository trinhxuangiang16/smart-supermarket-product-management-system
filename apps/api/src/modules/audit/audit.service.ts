import { prisma } from "../../lib/prisma.js";
import { getRequestContext } from "../../middleware/request-context.js";
const toJson = (value: unknown) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export const createAuditLog = async (input: {
  action: string; entity: string; entityId: string; userId: string; before?: unknown; after?: unknown; requestId?: string;
}) => prisma.auditLog.create({
  data: {
    ...input,
    requestId: input.requestId ?? getRequestContext()?.requestId ?? null,
    before: toJson(input.before) as any,
    after: toJson(input.after) as any,
  },
});
