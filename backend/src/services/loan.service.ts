import { Types } from "mongoose";
import { Book } from "../models/book.model";
import { Member } from "../models/member.model";
import { Loan, type LoanDocument } from "../models/loan.model";
import { ConflictError, NotFoundError, UnprocessableError } from "../errors/AppError";
import { countAvailableCopies } from "./availability.service";
import { accruedFineFor, settledFineFor } from "./fine.service";
import { removeReservationOnIssue } from "./reservation.service";
import {
  BORROW_LIMITS,
  type LoanDto,
  type LoanListQuery,
  type LoanSummaryDto,
  type Paginated,
} from "../../../shared/types";

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

export function toLoanDto(loan: LoanDocument): LoanDto {
  return {
    id: loan._id.toString(),
    bookId: loan.book ? loan.book.toString() : "",
    memberId: loan.member ? loan.member.toString() : "",
    issuedAt: loan.issuedAt.toISOString(),
    dueDate: loan.dueDate.toISOString(),
    returnedAt: loan.returnedAt ? loan.returnedAt.toISOString() : null,
    fineAmount: loan.fineAmount,
    accruedFine: accruedFineFor(loan),
    isOverdue: loan.isOverdue,
    paidAt: loan.paidAt ? loan.paidAt.toISOString() : null,
    daysUntilDue: loan.daysUntilDue,
    daysOverdue: loan.daysOverdue,
    waivedAt: loan.waivedAt ? loan.waivedAt.toISOString() : null,
  };
}

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

function toLoanSummaryDto(loan: LoanDocument): LoanSummaryDto {
  const book = loan.book as unknown as PopulatedBook | null;
  const member = loan.member as unknown as PopulatedMember | null;

  const { bookId: _bookId, memberId: _memberId, ...rest } = toLoanDto(loan);

  return {
    ...rest,
    book: book
      ? { id: book._id.toString(), title: book.title, author: book.author, isbn: book.isbn }
      : null,
    member: member ? { id: member._id.toString(), name: member.name } : null,
  };
}

export async function listLoansForMember(
  memberId: string,
  activeOnly: boolean
): Promise<LoanSummaryDto[]> {
  const filter: Record<string, unknown> = { member: memberId };
  if (activeOnly) filter.returnedAt = null;

  const loans = await Loan.find(filter)
    .sort({ issuedAt: -1 })
    .populate("book", "title author isbn")
    .populate("member", "name");

  return loans.map(toLoanSummaryDto);
}

export async function listLoans(query: LoanListQuery): Promise<Paginated<LoanSummaryDto>> {
  const filter: Record<string, unknown> = {};
  if (query.view === "active") filter.returnedAt = null;
  if (query.view === "overdue") {
    filter.returnedAt = null;
    filter.dueDate = { $lt: new Date() };
  }

  const skip = (query.page - 1) * query.pageSize;

  const [loans, total] = await Promise.all([
    Loan.find(filter)
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(query.pageSize)
      .populate("book", "title author isbn")
      .populate("member", "name"),
    Loan.countDocuments(filter),
  ]);

  return {
    items: loans.map(toLoanSummaryDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function issueLoan(bookId: string, memberId: string): Promise<LoanDto> {
  const book = await Book.findById(bookId);
  if (!book) throw new NotFoundError("No such book");

  const member = await Member.findById(memberId);
  if (!member) throw new NotFoundError("No such member");

  if (book.isWithdrawn) {
    throw new ConflictError("This title has been withdrawn from lending");
  }

  const available = await countAvailableCopies(book);
  if (available < 1) {
    throw new ConflictError("No copy of this book is available");
  }

  const activeLoans = await Loan.countDocuments({ member: member._id, returnedAt: null });
  if (activeLoans >= member.borrowLimit) {
    throw new UnprocessableError(
      `This member already holds ${activeLoans} of their ${member.borrowLimit} allowed books`
    );
  }

  let loan: LoanDocument;
  try {
    loan = await Loan.create({ book: book._id, member: member._id });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ConflictError("This member already has an active loan for this book");
    }
    throw error;
  }

  await removeReservationOnIssue(book._id, member._id);

  return toLoanDto(loan);
}

export async function returnLoan(loanId: string): Promise<LoanDto> {
  const loan = await Loan.findById(loanId);
  if (!loan) throw new NotFoundError("No such loan");

  if (loan.returnedAt !== null) {
    throw new ConflictError("This loan has already been returned");
  }

  loan.returnedAt = new Date();
  loan.fineAmount = settledFineFor(loan);
  await loan.save();

  return toLoanDto(loan);
}

export async function payFine(loanId: string, paidByUserId: string): Promise<LoanDto> {
  const loan = await Loan.findById(loanId);
  if (!loan) throw new NotFoundError("No such loan");

  if (loan.returnedAt === null) {
    throw new ConflictError("A fine can only be paid once the book has been returned");
  }
  if (loan.fineAmount === 0) {
    throw new ConflictError("This loan has no fine to pay");
  }
  if (loan.paidAt !== null) {
    throw new ConflictError("This fine has already been paid");
  }

  loan.paidAt = new Date();
  loan.paidBy = new Types.ObjectId(paidByUserId);
  await loan.save();

  return toLoanDto(loan);
}

export async function waiveFine(loanId: string, waivedByUserId: string): Promise<LoanDto> {
  const loan = await Loan.findById(loanId);
  if (!loan) throw new NotFoundError("No such loan");

  if (loan.returnedAt === null) {
    throw new ConflictError("A fine can only be waived once the book has been returned");
  }
  if (loan.fineAmount === 0) {
    throw new ConflictError("This loan has no fine to waive");
  }
  if (loan.paidAt !== null) {
    throw new ConflictError("This fine has already been paid");
  }

  loan.fineAmount = 0;
  loan.waivedAt = new Date();
  loan.waivedBy = new Types.ObjectId(waivedByUserId);
  await loan.save();

  return toLoanDto(loan);
}
