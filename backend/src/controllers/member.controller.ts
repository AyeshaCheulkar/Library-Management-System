import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import * as memberService from "../services/member.service";
import { isDeletePolicy } from "../services/dependents.service";
import { BadRequestError } from "../errors/AppError";
import {
  DEFAULT_DELETE_POLICY,
  DEFAULT_PAGE_SIZE,
  DELETE_POLICIES,
  MAX_PAGE_SIZE,
  type ApiResponse,
  type CreateMemberBody,
  type MemberDto,
  type Paginated,
  type UpdateMemberBody,
} from "../../../shared/types";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const requested = Number(req.query.pageSize) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, requested), MAX_PAGE_SIZE);

  const body: ApiResponse<Paginated<MemberDto>> = {
    data: await memberService.listMembers(page, pageSize),
  };
  res.status(200).json(body);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const body: ApiResponse<MemberDto> = {
    data: await memberService.getMember(req.params.id as string),
  };
  res.status(200).json(body);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const member = await memberService.createMember(req.body as CreateMemberBody);
  const body: ApiResponse<MemberDto> = { data: member };
  res.status(201).location(`/api/members/${member.id}`).json(body);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const member = await memberService.updateMember(
    req.params.id as string,
    req.body as UpdateMemberBody
  );
  const body: ApiResponse<MemberDto> = { data: member };
  res.status(200).json(body);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const requested = req.query.onDelete ?? DEFAULT_DELETE_POLICY;
  if (!isDeletePolicy(requested)) {
    throw new BadRequestError(`onDelete must be one of: ${DELETE_POLICIES.join(", ")}`);
  }

  await memberService.deleteMember(req.params.id as string, requested);
  res.status(204).send();
});
