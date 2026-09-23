import { Types } from "mongoose";
import { BookRequest, type BookRequestDocument } from "../models/request.model";
import { Book } from "../models/book.model";
import { Member } from "../models/member.model";
import { ConflictError, NotFoundError } from "../errors/AppError";
import { issueLoan } from "./loan.service";
import type { BookRequestDto, Paginated, RequestListQuery } from "../../../shared/types";

interface PopulatedBook {
  _id: Types.ObjectId;
  title: string;
  author: string;
  isbn: string;
}

interface PopulatedMember {
  _id: Types.ObjectId;
  name: string;
}

function isPopulated<T extends { _id: Types.ObjectId }>(value: unknown): value is T {
  return (
    typeof value === "object" &&
    value !== null &&
    "_id" in value &&
    !(value instanceof Types.ObjectId)
  );
}

function refIdOf(value: unknown): string {
  return isPopulated<{ _id: Types.ObjectId }>(value) ? value._id.toString() : String(value);
}

export function toRequestDto(request: BookRequestDocument): BookRequestDto {
  const book = isPopulated<PopulatedBook>(request.book) ? request.book : null;
  const member = isPopulated<PopulatedMember>(request.member) ? request.member : null;

  return {
    id: request._id.toString(),
    status: request.status,
    requestedAt: request.requestedAt.toISOString(),
    decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
    decisionNote: request.decisionNote,
    book: book
      ? { id: book._id.toString(), title: book.title, author: book.author, isbn: book.isbn }
      : null,
    member: member ? { id: member._id.toString(), name: member.name } : null,
    loanId: request.loan ? request.loan.toString() : null,
  };
}

async function findRequestOrFail(id: string): Promise<BookRequestDocument> {
  const request = await BookRequest.findById(id)
    .populate("book", "title author isbn")
    .populate("member", "name");
  if (!request) throw new NotFoundError("No such request");
  return request;
}

export async function createRequest(memberId: string, bookId: string): Promise<BookRequestDto> {
  const book = await Book.findById(bookId);
  if (!book) throw new NotFoundError("No such book");

  if (book.isWithdrawn) {
    throw new ConflictError("This title has been withdrawn from lending");
  }

  const member = await Member.findById(memberId);
  if (!member) throw new NotFoundError("No such member");

  try {
    const created = await BookRequest.create({ book: book._id, member: member._id });
    return toRequestDto(await findRequestOrFail(created._id.toString()));
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) {
      throw new ConflictError("You already have an open request for this book");
    }
    throw error;
  }
}

export async function listRequests(query: RequestListQuery): Promise<Paginated<BookRequestDto>> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  const skip = (query.page - 1) * query.pageSize;

  const [requests, total] = await Promise.all([
    BookRequest.find(filter)
      .sort({ requestedAt: 1 })
      .skip(skip)
      .limit(query.pageSize)
      .populate("book", "title author isbn")
      .populate("member", "name"),
    BookRequest.countDocuments(filter),
  ]);

  return {
    items: requests.map(toRequestDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listRequestsForMember(memberId: string): Promise<BookRequestDto[]> {
  const requests = await BookRequest.find({ member: memberId })
    .sort({ requestedAt: -1 })
    .populate("book", "title author isbn")
    .populate("member", "name");

  return requests.map(toRequestDto);
}

function assertPending(request: BookRequestDocument): void {
  if (request.status !== "pending") {
    throw new ConflictError(`This request was already ${request.status}`);
  }
}

export async function approveRequest(
  requestId: string,
  decidedByUserId: string
): Promise<BookRequestDto> {
  const request = await findRequestOrFail(requestId);
  assertPending(request);

  const loan = await issueLoan(refIdOf(request.book), refIdOf(request.member));

  request.status = "approved";
  request.decidedBy = new Types.ObjectId(decidedByUserId);
  request.decidedAt = new Date();
  request.loan = new Types.ObjectId(loan.id);
  await request.save();

  return toRequestDto(request);
}

export async function declineRequest(
  requestId: string,
  decidedByUserId: string,
  note?: string
): Promise<BookRequestDto> {
  const request = await findRequestOrFail(requestId);
  assertPending(request);

  request.status = "declined";
  request.decidedBy = new Types.ObjectId(decidedByUserId);
  request.decidedAt = new Date();
  request.decisionNote = note ?? null;
  await request.save();

  return toRequestDto(request);
}

export async function cancelRequest(
  requestId: string,
  memberId: string
): Promise<BookRequestDto> {
  const request = await findRequestOrFail(requestId);

  if (refIdOf(request.member) !== memberId) throw new NotFoundError("No such request");

  assertPending(request);

  request.status = "cancelled";
  request.decidedAt = new Date();
  await request.save();

  return toRequestDto(request);
}

export async function withdrawRequestsForBook(bookId: string): Promise<number> {
  const result = await BookRequest.deleteMany({ book: bookId, status: "pending" });
  return result.deletedCount ?? 0;
}
