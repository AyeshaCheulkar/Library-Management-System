import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import * as bookService from "../services/book.service";
import * as availabilityService from "../services/availability.service";
import * as reservationService from "../services/reservation.service";
import { isDeletePolicy } from "../services/dependents.service";
import { currentUser } from "../middleware/authenticate";
import { findMemberIdForUser } from "../services/member.service";
import { BadRequestError, UnprocessableError } from "../errors/AppError";
import {
  DEFAULT_DELETE_POLICY,
  DEFAULT_PAGE_SIZE,
  DELETE_POLICIES,
  MAX_PAGE_SIZE,
  type ApiResponse,
  type BookAvailabilityDto,
  type BookDto,
  type CategoryDto,
  type CreateBookBody,
  type Paginated,
  type UpdateBookBody,
} from "../../../shared/types";

function readPaging(req: Request): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const requested = Number(req.query.pageSize) || DEFAULT_PAGE_SIZE;
  return { page, pageSize: Math.min(Math.max(1, requested), MAX_PAGE_SIZE) };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readFlag(value: unknown): boolean {
  return value === "true" || value === "1";
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize } = readPaging(req);
  const result = await bookService.listBooks({
    page,
    pageSize,
    ...(readString(req.query.search) === undefined ? {} : { search: readString(req.query.search) }),
    ...(readString(req.query.category) === undefined
      ? {}
      : { category: readString(req.query.category) }),
    availableOnly: readFlag(req.query.available),
  });

  const body: ApiResponse<Paginated<BookDto>> = { data: result };
  res.status(200).json(body);
});

export const categories = asyncHandler(async (_req: Request, res: Response) => {
  const body: ApiResponse<CategoryDto[]> = { data: await bookService.listCategories() };
  res.status(200).json(body);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const body: ApiResponse<BookDto> = { data: await bookService.getBook(req.params.id as string) };
  res.status(200).json(body);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const book = await bookService.createBook(req.body as CreateBookBody);
  const body: ApiResponse<BookDto> = { data: book };
  res.status(201).location(`/api/books/${book.id}`).json(body);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const book = await bookService.updateBook(req.params.id as string, req.body as UpdateBookBody);
  const body: ApiResponse<BookDto> = { data: book };
  res.status(200).json(body);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const requested = req.query.onDelete ?? DEFAULT_DELETE_POLICY;
  if (!isDeletePolicy(requested)) {
    throw new BadRequestError(`onDelete must be one of: ${DELETE_POLICIES.join(", ")}`);
  }

  await bookService.deleteBook(req.params.id as string, requested);
  res.status(204).send();
});

export const availability = asyncHandler(async (req: Request, res: Response) => {
  const body: ApiResponse<BookAvailabilityDto> = {
    data: await availabilityService.getAvailability(req.params.id as string),
  };
  res.status(200).json(body);
});

async function ownMemberId(req: Request): Promise<string> {
  const memberId = await findMemberIdForUser(currentUser(req).id);
  if (memberId === null) {
    throw new UnprocessableError("This account has no borrower record, so it cannot reserve");
  }
  return memberId;
}

export const reserve = asyncHandler(async (req: Request, res: Response) => {
  const book = await reservationService.reserve(req.params.id as string, await ownMemberId(req));
  const body: ApiResponse<BookDto> = { data: bookService.toBookDto(book) };
  res.status(201).json(body);
});

export const cancelReservation = asyncHandler(async (req: Request, res: Response) => {
  await reservationService.cancelReservation(req.params.id as string, await ownMemberId(req));
  res.status(204).send();
});
