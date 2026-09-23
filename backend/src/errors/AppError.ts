import type { ErrorCode } from "../../../shared/types";

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: ErrorCode;

  readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

export class BadRequestError extends AppError {
  override readonly status: number = 400;
  override readonly code: ErrorCode = "BAD_REQUEST";
}

export class AuthenticationError extends AppError {
  override readonly status: number = 401;
  override readonly code: ErrorCode = "UNAUTHENTICATED";
}

export class ForbiddenError extends AppError {
  override readonly status: number = 403;
  override readonly code: ErrorCode = "FORBIDDEN";
}

export class NotFoundError extends AppError {
  override readonly status: number = 404;
  override readonly code: ErrorCode = "NOT_FOUND";
}

export class ConflictError extends AppError {
  override readonly status: number = 409;
  override readonly code: ErrorCode = "CONFLICT";
}

export class UnprocessableError extends AppError {
  override readonly status: number = 422;
  override readonly code: ErrorCode = "UNPROCESSABLE";
}

export class TooManyRequestsError extends AppError {
  override readonly status: number = 429;
  override readonly code: ErrorCode = "RATE_LIMITED";
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
