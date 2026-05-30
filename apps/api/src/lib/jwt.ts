import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signAccessToken = (payload: { userId: string; role: string }) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });

export const signRefreshToken = (payload: { userId: string; role: string }) =>
  jwt.sign(payload, env.refreshJwtSecret, { expiresIn: env.refreshJwtExpiresIn as jwt.SignOptions["expiresIn"] });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.jwtSecret) as { userId: string; role: string };

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.refreshJwtSecret) as { userId: string; role: string };
