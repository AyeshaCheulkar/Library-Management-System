import type { Request, RequestHandler } from "express";
import { AuthenticationError } from "../errors/AppError";
import { verifyAccessToken } from "../services/auth.service";
import { asyncMiddleware } from "./asyncHandler";
import type { Role } from "../../../shared/types";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function currentUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AuthenticationError("Authentication required");
  return req.user;
}

function readBearerToken(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) {
    throw new AuthenticationError("Authentication required");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw new AuthenticationError("Authentication required");
  return token;
}

export const authenticate: RequestHandler = asyncMiddleware(async (req) => {
  const user = await verifyAccessToken(readBearerToken(req.headers.authorization));
  req.user = { id: user._id.toString(), email: user.email, role: user.role };
});
