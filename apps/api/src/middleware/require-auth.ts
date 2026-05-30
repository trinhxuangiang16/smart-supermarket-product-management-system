import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing token" } });
    const decoded = verifyAccessToken(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
    if (!user.isActive) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Account disabled" } });

    const reportOnlyRoles = ["SALE_DEPARTMENT", "FINANCE_DEPARTMENT"];
    const url = req.originalUrl || req.path;
    const isReportsPath = url.includes("/api/reports");
    const isAuditPath = url.includes("/api/audit");
    const isMePath = url.includes("/api/auth/me");
    if (reportOnlyRoles.includes(user.role) && !isReportsPath && !isAuditPath && !isMePath) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "This role can only access reports",
        },
      });
    }

    req.user = { id: user.id, role: user.role, email: user.email };
    next();
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
  }
};
