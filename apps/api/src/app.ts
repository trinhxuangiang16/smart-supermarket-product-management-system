import "express-async-errors";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import routes from "./routes/index.js";

export const app = express();
app.use(requestIdMiddleware);
app.use(requestContextMiddleware);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === env.corsOrigin) return callback(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
}));
app.use(express.json());
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", routes);
app.use(errorHandler);
