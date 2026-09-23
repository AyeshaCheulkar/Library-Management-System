import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler, notFound } from "./middleware/errorHandler";
import apiRouter from "./routes";

const app = express();

if (env.trustProxy > 0) app.set("trust proxy", env.trustProxy);

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.use(requestLogger);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.use("/api", apiRouter);

const buildDir = path.resolve(__dirname, "../../frontend/build");

if (!env.isTest && fs.existsSync(path.join(buildDir, "index.html"))) {
  app.use(express.static(buildDir));

  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(buildDir, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
