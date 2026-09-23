import rateLimit, { MemoryStore } from "express-rate-limit";
import { env } from "../config/env";
import { TooManyRequestsError } from "../errors/AppError";

const store = new MemoryStore();

export const loginRateLimiter = rateLimit({
  windowMs: env.loginRateLimitWindowMs,
  limit: env.loginRateLimitMax,
  store,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError("Too many login attempts, please try again later"));
  },
});

export function resetLoginRateLimit(): void {
  store.resetAll();
}
