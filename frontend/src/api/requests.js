import { get, post, patch, del } from "./client";

export const requestBook = (bookId) => post("/api/requests", { bookId });

export const listMyRequests = () => get("/api/requests/mine");

export function listRequests({ status = "pending", page = 1, pageSize = 50 } = {}) {
  const query = new URLSearchParams({ page, pageSize });
  if (status) query.set("status", status);
  return get(`/api/requests?${query.toString()}`);
}

export const approveRequest = (id) => patch(`/api/requests/${id}/approve`);
export const declineRequest = (id, note) => patch(`/api/requests/${id}/decline`, { note });
export const cancelRequest = (id) => del(`/api/requests/${id}`);
