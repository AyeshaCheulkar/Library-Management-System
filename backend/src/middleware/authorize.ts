import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ForbiddenError } from "../errors/AppError";
import { currentUser } from "./authenticate";
import type { Role } from "../../../shared/types";

export function authorize(...allowed: readonly Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = currentUser(req);
      if (!allowed.includes(user.role)) {
        throw new ForbiddenError("Your role does not permit this action");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
