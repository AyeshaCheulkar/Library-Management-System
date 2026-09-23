import { get, post, patch, del } from "./client";

export function listBooks({
  page = 1,
  pageSize = 12,
  search = "",
  category = "",
  availableOnly = false,
} = {}) {
  const query = new URLSearchParams({ page, pageSize });
  if (search) query.set("search", search);
  if (category) query.set("category", category);
  if (availableOnly) query.set("available", "true");
  return get(`/api/books?${query.toString()}`);
}

export const listCategories = () => get("/api/books/categories");

export const getBook = (id) => get(`/api/books/${id}`);
export const getAvailability = (id) => get(`/api/books/${id}/availability`);
export const createBook = (book) => post("/api/books", book);
export const updateBook = (id, patchBody) => patch(`/api/books/${id}`, patchBody);
export const deleteBook = (id, onDelete = "block") =>
  del(`/api/books/${id}?onDelete=${onDelete}`);

export const reserve = (id) => post(`/api/books/${id}/reserve`);
export const cancelReservation = (id) => del(`/api/books/${id}/reserve`);
