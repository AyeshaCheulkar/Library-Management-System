import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import * as requestService from "../services/request.service";
import { currentUser } from "../middleware/authenticate";
import { findMemberIdForUser } from "../services/member.service";
import { UnprocessableError } from "../errors/AppError";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  REQUEST_STATUSES,
  type ApiResponse,
  type BookRequestDto,
  type CreateRequestBody,
  type DeclineRequestBody,
  type Paginated,
  type RequestStatus,
} from "../../../shared/types";

async function ownMemberIdOrFail(req: Request): Promise<string> {
  const memberId = await findMemberIdForUser(currentUser(req).id);
  if (!memberId) {
    throw new UnprocessableError("This account has no borrower record, so it cannot request books");
  }
  return memberId;
}

function readStatus(value: unknown): RequestStatus | undefined {
  return REQUEST_STATUSES.find((status) => status === value);
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateRequestBody;
  const memberId = await ownMemberIdOrFail(req);

  const created = await requestService.createRequest(memberId, body.bookId);

  const payload: ApiResponse<BookRequestDto> = { data: created };
  res.status(201).location(`/api/requests/${created.id}`).json(payload);
});

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const memberId = await ownMemberIdOrFail(req);

  const payload: ApiResponse<BookRequestDto[]> = {
    data: await requestService.listRequestsForMember(memberId),
  };
  res.status(200).json(payload);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const requested = Number(req.query.pageSize) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, requested), MAX_PAGE_SIZE);
  const status = readStatus(req.query.status);

  const result = await requestService.listRequests({
    page,
    pageSize,
    ...(status === undefined ? {} : { status }),
  });

  const payload: ApiResponse<Paginated<BookRequestDto>> = { data: result };
  res.status(200).json(payload);
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const payload: ApiResponse<BookRequestDto> = {
    data: await requestService.approveRequest(req.params.id as string, currentUser(req).id),
  };
  res.status(200).json(payload);
});

export const decline = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as DeclineRequestBody;

  const payload: ApiResponse<BookRequestDto> = {
    data: await requestService.declineRequest(
      req.params.id as string,
      currentUser(req).id,
      body.note
    ),
  };
  res.status(200).json(payload);
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const memberId = await ownMemberIdOrFail(req);

  const payload: ApiResponse<BookRequestDto> = {
    data: await requestService.cancelRequest(req.params.id as string, memberId),
  };
  res.status(200).json(payload);
});
