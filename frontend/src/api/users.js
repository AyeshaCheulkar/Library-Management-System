import { get, patch } from "./client";

export function listAccounts({ page = 1, pageSize = 100 } = {}) {
  const query = new URLSearchParams({ page, pageSize });
  return get(`/api/users?${query.toString()}`);
}

export const changeRole = (id, role) => patch(`/api/users/${id}/role`, { role });
export const setActive = (id, isActive) => patch(`/api/users/${id}/active`, { isActive });
