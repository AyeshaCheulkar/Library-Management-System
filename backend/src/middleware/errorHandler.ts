import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import type { ApiError, ErrorCode } from "../../../shared/types";
import { AppError, NotFoundError, isAppError } from "../errors/AppError";
import { env } from "../config/env";

interface Translated {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
}

function isDuplicateKeyError(error: unknown): error is { keyPattern?: Record<string, unknown> } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function translate(error: unknown): Translated {
  if (isAppError(error)) {
    const appError: AppError = error;
    return {
      status: appError.status,
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined ? {} : { details: appError.details }),
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const fields: Record<string, string> = {};
    for (const [path, issue] of Object.entries(error.errors)) {
      fields[path] = issue.message;
    }
    return {
      status: 400,
      code: "BAD_REQUEST",
      message: "Validation failed",
      details: { fields },
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return { status: 400, code: "BAD_REQUEST", message: `Invalid value for "${error.path}"` };
  }

  if (isDuplicateKeyError(error)) {
    const field = Object.keys(error.keyPattern ?? {}).join(", ") || "value";
    return { status: 409, code: "CONFLICT", message: `That ${field} is already taken` };
  }

  return { status: 500, code: "INTERNAL", message: "Something went wrong" };
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const { status, code, message, details } = translate(error);
  const requestId = res.locals.requestId ?? "unknown";

  if (status >= 500 && !env.isTest) {
    console.error(JSON.stringify({ requestId, level: "error", error: String(error) }));
    if (error instanceof Error && error.stack) console.error(error.stack);
  }

  const body: ApiError = {
    error: { code, message, ...(details === undefined ? {} : { details }), requestId },
  };

  res.status(status).json(body);
};

export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
};
