import { get, post, patch, del } from "./client";

export function listMembers({ page = 1, pageSize = 50 } = {}) {
  return get(`/api/members?page=${page}&pageSize=${pageSize}`);
}

export const getMember = (id) => get(`/api/members/${id}`);
export const createMember = (member) => post("/api/members", member);
export const updateMember = (id, patchBody) => patch(`/api/members/${id}`, patchBody);
export const deleteMember = (id, onDelete = "block") =>
  del(`/api/members/${id}?onDelete=${onDelete}`);

export const listLoansForMember = (id, activeOnly = false) =>
  get(`/api/members/${id}/loans${activeOnly ? "?active=true" : ""}`);
