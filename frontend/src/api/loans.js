import { get, post, patch } from "./client";

export function listLoans({ view = "active", page = 1, pageSize = 100 } = {}) {
  const query = new URLSearchParams({ page, pageSize, view });
  return get(`/api/loans?${query.toString()}`);
}

export const issueLoan = (bookId, memberId) => post("/api/loans", { bookId, memberId });
export const returnLoan = (id) => patch(`/api/loans/${id}/return`);
export const payFine = (id) => patch(`/api/loans/${id}/pay`);
export const waiveFine = (id) => patch(`/api/loans/${id}/waive-fine`);
