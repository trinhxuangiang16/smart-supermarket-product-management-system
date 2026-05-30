import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { comparePassword, hashPassword } from "../../lib/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { ok } from "../../lib/response.js";
import { requireAuth, AuthRequest } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const refreshSchema = z.object({ refreshToken: z.string().min(10) });
const createUserSchema = z.object({
  email: z.string().email(), name: z.string().min(2), password: z.string().min(8),
  role: z.enum(["ADMIN", "MANAGER", "WAREHOUSE_STAFF", "CASHIER", "SALE_DEPARTMENT", "FINANCE_DEPARTMENT"]),
});

const revokedRefreshTokens = new Set<string>();
const rememberRevokedToken = (token: string) => {
  revokedRefreshTokens.add(token);
  if (revokedRefreshTokens.size > 10000) {
    const first = revokedRefreshTokens.values().next().value;
    if (first) revokedRefreshTokens.delete(first);
  }
};

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: { code: "ACCOUNT_DISABLED", message: "Account is disabled" } });
  }
  const token = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role });
  return res.json(ok({ token, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } }));
});

router.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid refresh payload", details: parsed.error.flatten() } });
  if (revokedRefreshTokens.has(parsed.data.refreshToken)) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Refresh token revoked" } });
  }
  try {
    const decoded = verifyRefreshToken(parsed.data.refreshToken);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid refresh token" } });
    }
    rememberRevokedToken(parsed.data.refreshToken);
    const token = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });
    return res.json(ok({ token, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } }));
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid refresh token" } });
  }
});

router.post("/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (parsed.success) rememberRevokedToken(parsed.data.refreshToken);
  return res.json(ok({ loggedOut: true }, "Logged out"));
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  return res.json(ok(req.user));
});

router.post("/register", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() } });
  if (parsed.data.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount > 0) {
      return res.status(409).json({ error: { code: "CONFLICT", message: "System allows only one admin account" } });
    }
  }
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: { code: "CONFLICT", message: "Email already exists" } });
  const user = await prisma.user.create({ data: { ...parsed.data, passwordHash: await hashPassword(parsed.data.password) } });
  return res.status(201).json(ok({ id: user.id, email: user.email, name: user.name, role: user.role }, "User created"));
});

export default router;
