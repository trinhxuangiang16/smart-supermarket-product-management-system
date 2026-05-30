import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.trim() ? incoming.trim() : randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};

