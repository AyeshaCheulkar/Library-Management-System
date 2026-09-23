import crypto from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../config/env";

const SECRET_KEY = /pass(word)?|token|secret|authorization|cookie|hash/i;
const REDACTED = "[REDACTED]";

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SECRET_KEY.test(key) ? REDACTED : redact(nested, depth + 1);
  }
  return output;
}

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
    }
  }
}

export const requestLogger: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const requestId = crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const elapsedMs = (): number => Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  const originalEnd = res.end.bind(res);
  res.end = function patchedEnd(this: Response, ...args: unknown[]) {
    if (!res.headersSent) {
      res.setHeader("X-Response-Time-Ms", elapsedMs().toFixed(1));
    }
    return (originalEnd as (...a: unknown[]) => Response).apply(this, args);
  } as typeof res.end;

  res.on("finish", () => {
    const line = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Number(elapsedMs().toFixed(1)),
      ...(env.isProduction || req.method === "GET" ? {} : { body: redact(req.body) }),
    };
    if (!env.isTest) console.log(JSON.stringify(line));
  });

  next();
};
