import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { comparePassword, hashPassword } from "../../lib/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { ok } from "../../lib/response.js";
import { requireAuth, AuthRequest } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { createAuditLog } from "../audit/audit.service.js";

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const refreshSchema = z.object({ refreshToken: z.string().min(10) });
const revokeOthersSchema = z.object({ currentRefreshToken: z.string().min(10).optional() });
const createUserSchema = z.object({
  email: z.string().email(), name: z.string().min(2), password: z.string().min(8),
  role: z.enum(["ADMIN", "MANAGER", "WAREHOUSE_STAFF", "CASHIER", "SALE_DEPARTMENT", "FINANCE_DEPARTMENT"]),
});
const revokeSessionSchema = z.object({ sessionId: z.string().min(1) });

const revokedRefreshTokens = new Set<string>();
const rememberRevokedToken = (token: string) => {
  revokedRefreshTokens.add(token);
  if (revokedRefreshTokens.size > 10000) {
    const first = revokedRefreshTokens.values().next().value;
    if (first) revokedRefreshTokens.delete(first);
  }
};

const getDeviceLabel = (userAgent?: string | string[]) => {
  const ua = Array.isArray(userAgent) ? userAgent.join(" ") : (userAgent ?? "");
  if (!ua) return "Unknown device";
  if (ua.includes("Windows")) return "Windows device";
  if (ua.includes("Macintosh")) return "Mac device";
  if (ua.includes("Android")) return "Android device";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS device";
  return "Browser device";
};

const getIpAddress = (req: any) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "";
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
  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken,
      userAgent: String(req.headers["user-agent"] ?? ""),
      ipAddress: getIpAddress(req),
      deviceLabel: getDeviceLabel(req.headers["user-agent"]),
      lastActiveAt: new Date(),
    },
  });
  await createAuditLog({
    action: "AUTH_LOGIN",
    entity: "UserSession",
    entityId: user.id,
    userId: user.id,
    after: { email: user.email, role: user.role, deviceLabel: getDeviceLabel(req.headers["user-agent"]) },
  });
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
    const activeSession = await prisma.userSession.findFirst({
      where: { refreshToken: parsed.data.refreshToken, revokedAt: null },
    });
    if (!activeSession) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Refresh session revoked" } });
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid refresh token" } });
    }
    rememberRevokedToken(parsed.data.refreshToken);
    const token = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });
    await prisma.$transaction([
      prisma.userSession.update({
        where: { id: activeSession.id },
        data: { revokedAt: new Date(), lastActiveAt: new Date() },
      }),
      prisma.userSession.create({
        data: {
          userId: user.id,
          refreshToken,
          userAgent: String(req.headers["user-agent"] ?? ""),
          ipAddress: getIpAddress(req),
          deviceLabel: getDeviceLabel(req.headers["user-agent"]),
          lastActiveAt: new Date(),
        },
      }),
    ]);
    await createAuditLog({
      action: "AUTH_REFRESH",
      entity: "UserSession",
      entityId: activeSession.id,
      userId: user.id,
      before: { sessionId: activeSession.id, refreshToken: "ROTATED" },
      after: { userId: user.id, role: user.role, refreshToken: "ROTATED" },
    });
    return res.json(ok({ token, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } }));
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid refresh token" } });
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (parsed.success) {
    rememberRevokedToken(parsed.data.refreshToken);
    const result = await prisma.userSession.updateMany({
      where: { refreshToken: parsed.data.refreshToken, revokedAt: null },
      data: { revokedAt: new Date(), lastActiveAt: new Date() },
    });
    await createAuditLog({
      action: "AUTH_LOGOUT",
      entity: "UserSession",
      entityId: req.user!.id,
      userId: req.user!.id,
      after: { revokedSessions: result.count },
    });
  }
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

router.get("/sessions", requireAuth, async (req: AuthRequest, res) => {
  const sessions = await prisma.userSession.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return res.json(ok(sessions));
});

router.post("/sessions/revoke", requireAuth, async (req: AuthRequest, res) => {
  const parsed = revokeSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid revoke payload", details: parsed.error.flatten() } });
  const session = await prisma.userSession.findUnique({ where: { id: parsed.data.sessionId } });
  if (!session || session.userId !== req.user!.id) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  await prisma.userSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date(), lastActiveAt: new Date() },
  });
  rememberRevokedToken(session.refreshToken);
  await createAuditLog({
    action: "AUTH_SESSION_REVOKE",
    entity: "UserSession",
    entityId: session.id,
    userId: req.user!.id,
    before: { revokedAt: session.revokedAt },
    after: { revokedAt: new Date().toISOString() },
  });
  return res.json(ok({ id: session.id }, "Session revoked"));
});

router.post("/sessions/revoke-others", requireAuth, async (req: AuthRequest, res) => {
  const parsed = revokeOthersSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() } });

  const activeSessions = await prisma.userSession.findMany({
    where: { userId: req.user!.id, revokedAt: null },
    select: { id: true, refreshToken: true },
  });
  const keepToken = parsed.data.currentRefreshToken;
  const toRevoke = activeSessions.filter((session: any) => session.refreshToken !== keepToken);
  if (!toRevoke.length) return res.json(ok({ revoked: 0 }, "No other active sessions"));

  const ids = toRevoke.map((s: any) => s.id);
  const result = await prisma.userSession.updateMany({
    where: { id: { in: ids } },
    data: { revokedAt: new Date(), lastActiveAt: new Date() },
  });
  for (const item of toRevoke) rememberRevokedToken(item.refreshToken);

  await createAuditLog({
    action: "AUTH_SESSION_REVOKE_OTHERS",
    entity: "UserSession",
    entityId: req.user!.id,
    userId: req.user!.id,
    after: { revoked: result.count },
  });
  return res.json(ok({ revoked: result.count }, "Other sessions revoked"));
});

export default router;
