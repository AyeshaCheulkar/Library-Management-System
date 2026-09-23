import type { RequestHandler } from "express";
import { ForbiddenError } from "../errors/AppError";
import { currentUser } from "./authenticate";
import { asyncMiddleware } from "./asyncHandler";
import { findMemberIdForUser } from "../services/member.service";

export const ownsMemberRecord: RequestHandler = asyncMiddleware(async (req) => {
  const user = currentUser(req);

  if (user.role === "librarian" || user.role === "admin") return;

  const ownMemberId = await findMemberIdForUser(user.id);
  if (ownMemberId === null || ownMemberId !== req.params.id) {
    throw new ForbiddenError("You may only access your own records");
  }
});
