import { AsyncLocalStorage } from "node:async_hooks";
import { NextFunction, Request, Response } from "express";

type RequestContext = {
  requestId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContextMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId as string | undefined;
  storage.run({ requestId }, () => next());
};

export const getRequestContext = () => storage.getStore();

