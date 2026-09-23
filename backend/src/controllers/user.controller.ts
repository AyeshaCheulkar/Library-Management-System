import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import * as userService from "../services/user.service";
import { currentUser } from "../middleware/authenticate";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type ApiResponse,
  type Paginated,
  type UpdateUserActiveBody,
  type UpdateUserRoleBody,
  type UserAccountDto,
} from "../../../shared/types";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const requested = Number(req.query.pageSize) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, requested), MAX_PAGE_SIZE);

  const payload: ApiResponse<Paginated<UserAccountDto>> = {
    data: await userService.listAccounts(page, pageSize),
  };
  res.status(200).json(payload);
});

export const changeRole = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateUserRoleBody;

  const payload: ApiResponse<UserAccountDto> = {
    data: await userService.changeRole(req.params.id as string, body.role, currentUser(req).id),
  };
  res.status(200).json(payload);
});

export const setActive = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateUserActiveBody;

  const payload: ApiResponse<UserAccountDto> = {
    data: await userService.setActive(
      req.params.id as string,
      body.isActive,
      currentUser(req).id
    ),
  };
  res.status(200).json(payload);
});
