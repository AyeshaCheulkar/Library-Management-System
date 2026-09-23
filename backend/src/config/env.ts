import "dotenv/config";
import crypto from "node:crypto";

const isTest = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

const PLACEHOLDERS = new Set(["changeme", "change-me", "secret", ""]);

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (value !== undefined && !PLACEHOLDERS.has(value)) return value;
  if (isTest) return crypto.randomBytes(32).toString("hex");
  throw new Error(
    `${name} is missing or still set to a placeholder. Generate one with:\n` +
      `  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
  );
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number, got "${raw}"`);
  return parsed;
}

const bcryptCost = optionalNumber("BCRYPT_COST", 12);
if (bcryptCost < 12) throw new Error(`BCRYPT_COST must be at least 12, got ${bcryptCost}`);

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  isProduction: process.env.NODE_ENV === "production",
  isTest,
  port: optionalNumber("PORT", 4000),

  mongoUri: optional("MONGODB_URI", "mongodb://127.0.0.1:27017/library"),

  accessTokenSecret: requiredSecret("JWT_ACCESS_SECRET"),
  refreshTokenSecret: requiredSecret("JWT_REFRESH_SECRET"),
  accessTokenTtl: optional("ACCESS_TOKEN_TTL", "15m"),
  refreshTokenTtl: optional("REFRESH_TOKEN_TTL", "7d"),

  bcryptCost,

  corsOrigin: optional("CORS_ORIGIN", "http://localhost:3000"),

  loginRateLimitWindowMs: optionalNumber("LOGIN_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  loginRateLimitMax: optionalNumber("LOGIN_RATE_LIMIT_MAX", 5),

  trustProxy: optionalNumber("TRUST_PROXY", 0),
} as const;

export type Env = typeof env;
