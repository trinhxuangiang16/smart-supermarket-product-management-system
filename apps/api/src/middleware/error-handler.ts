import { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const requestId = (req as any).requestId as string | undefined;
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("Can't reach database server")) {
    return res.status(503).json({
      error: {
        code: "DB_UNAVAILABLE",
        message: "Database is unavailable. Please start MySQL and try again.",
        ...(requestId ? { requestId } : {}),
        ...(env.nodeEnv === "development"
          ? { details: { message } }
          : {}),
      },
    });
  }
  const details = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { raw: String(err) };
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
      ...(requestId ? { requestId } : {}),
      ...(env.nodeEnv === "development" ? { details } : {}),
    },
  });
};
