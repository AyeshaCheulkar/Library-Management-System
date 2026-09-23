import { FINE_RATE_PER_DAY, type LoanDocument } from "../models/loan.model";

export function accruedFineFor(loan: LoanDocument): number {
  if (loan.returnedAt !== null) return 0;
  return loan.daysOverdue * FINE_RATE_PER_DAY;
}

export function settledFineFor(loan: LoanDocument): number {
  return loan.daysOverdue * FINE_RATE_PER_DAY;
}
