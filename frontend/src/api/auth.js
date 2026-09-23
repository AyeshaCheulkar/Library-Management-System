import { post, patch, get, setAccessToken } from "./client";

export const login = (email, password) => post("/api/auth/login", { email, password });

export const register = (name, email, password) =>
  post("/api/auth/register", { name, email, password });

export const me = () => get("/api/auth/me");

export const changePassword = (currentPassword, newPassword) =>
  patch("/api/auth/password", { currentPassword, newPassword });

export async function logout() {
  await post("/api/auth/logout");
  setAccessToken(null);
}
