import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(handler: AsyncFn): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function asyncMiddleware(handler: AsyncFn): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).then(() => next(), next);
  };
}
