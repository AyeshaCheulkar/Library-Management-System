import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { currentUser } from "../middleware/authenticate";
import * as loanService from "../services/loan.service";
import {
  DEFAULT_PAGE_SIZE,
  LOAN_VIEWS,
  MAX_PAGE_SIZE,
  type ApiResponse,
  type IssueLoanBody,
  type LoanDto,
  type LoanSummaryDto,
  type LoanView,
  type Paginated,
} from "../../../shared/types";

function readView(value: unknown): LoanView {
  return LOAN_VIEWS.find((view) => view === value) ?? "active";
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const requested = Number(req.query.pageSize) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, requested), MAX_PAGE_SIZE);

  const result = await loanService.listLoans({
    page,
    pageSize,
    view: readView(req.query.view),
  });

  const body: ApiResponse<Paginated<LoanSummaryDto>> = { data: result };
  res.status(200).json(body);
});

export const issue = asyncHandler(async (req: Request, res: Response) => {
  const { bookId, memberId } = req.body as IssueLoanBody;
  const loan = await loanService.issueLoan(bookId, memberId);

  const body: ApiResponse<LoanDto> = { data: loan };
  res.status(201).location(`/api/loans/${loan.id}`).json(body);
});

export const returnBook = asyncHandler(async (req: Request, res: Response) => {
  const body: ApiResponse<LoanDto> = {
    data: await loanService.returnLoan(req.params.id as string),
  };
  res.status(200).json(body);
});

export const payFine = asyncHandler(async (req: Request, res: Response) => {
  const loan = await loanService.payFine(req.params.id as string, currentUser(req).id);

  const body: ApiResponse<LoanDto> = { data: loan };
  res.status(200).json(body);
});

export const waiveFine = asyncHandler(async (req: Request, res: Response) => {
  const loan = await loanService.waiveFine(req.params.id as string, currentUser(req).id);

  const body: ApiResponse<LoanDto> = { data: loan };
  res.status(200).json(body);
});

export const listForMember = asyncHandler(async (req: Request, res: Response) => {
  const activeOnly = req.query.active === "true";
  const loans = await loanService.listLoansForMember(req.params.id as string, activeOnly);

  const body: ApiResponse<LoanSummaryDto[]> = { data: loans };
  res.status(200).json(body);
});
