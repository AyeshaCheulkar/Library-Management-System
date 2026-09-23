import { Types } from "mongoose";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { BadRequestError } from "../errors/AppError";

export type FieldType = "string" | "number" | "boolean" | "objectId";

export interface FieldRule {
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: readonly string[];
}

export type BodySchema = Record<string, FieldRule>;

function checkField(value: unknown, rule: FieldRule): string | null {
  switch (rule.type) {
    case "string": {
      if (typeof value !== "string") return "must be a string";
      if (rule.min !== undefined && value.length < rule.min) {
        return `must be at least ${rule.min} characters`;
      }
      if (rule.max !== undefined && value.length > rule.max) {
        return `must be at most ${rule.max} characters`;
      }
      if (rule.pattern && !rule.pattern.test(value)) return "is not in the expected format";
      if (rule.enum && !rule.enum.includes(value)) {
        return `must be one of: ${rule.enum.join(", ")}`;
      }
      return null;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "must be a number";
      if (rule.min !== undefined && value < rule.min) return `must be at least ${rule.min}`;
      if (rule.max !== undefined && value > rule.max) return `must be at most ${rule.max}`;
      return null;
    }
    case "boolean":
      return typeof value === "boolean" ? null : "must be true or false";
    case "objectId":
      return typeof value === "string" && Types.ObjectId.isValid(value)
        ? null
        : "must be a valid id";
  }
}

export function validateBody(schema: BodySchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const body: unknown = req.body;
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return next(new BadRequestError("Request body must be a JSON object"));
    }

    const source = body as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    const fields: Record<string, string> = {};

    for (const [name, rule] of Object.entries(schema)) {
      const value = source[name];

      if (value === undefined || value === null) {
        if (rule.required) fields[name] = "is required";
        continue;
      }

      const problem = checkField(value, rule);
      if (problem) {
        fields[name] = problem;
        continue;
      }

      clean[name] = typeof value === "string" ? value.trim() : value;
    }

    if (Object.keys(fields).length > 0) {
      return next(new BadRequestError("Validation failed", { fields }));
    }

    req.body = clean;
    next();
  };
}

export function validateObjectId(param = "id"): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req.params[param];
    if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
      return next(new BadRequestError(`Route parameter "${param}" must be a valid id`));
    }
    next();
  };
}
