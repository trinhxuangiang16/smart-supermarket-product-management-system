import { Response, NextFunction } from "express";
import { AuthRequest } from "./require-auth.js";

export const requireRole = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Forbidden" } });
  next();
};
