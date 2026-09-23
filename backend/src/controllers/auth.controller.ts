import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import { asyncHandler } from "../middleware/asyncHandler";
import { currentUser } from "../middleware/authenticate";
import * as authService from "../services/auth.service";
import type {
  ApiResponse,
  AuthResponse,
  ChangePasswordBody,
  LoginBody,
  RegisterBody,
  UserDto,
} from "../../../shared/types";

const REFRESH_COOKIE = "refreshToken";

const refreshCookieScope: CookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: env.isProduction,
  path: "/api/auth",
};

const refreshCookieOptions: CookieOptions = {
  ...refreshCookieScope,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

async function sendSession(
  res: Response,
  session: authService.Session,
  status: number
): Promise<void> {
  res.cookie(REFRESH_COOKIE, session.refreshToken, refreshCookieOptions);
  const body: ApiResponse<AuthResponse> = {
    data: {
      user: await authService.toUserDto(session.user),
      accessToken: session.accessToken,
    },
  };
  res.status(status).json(body);
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body as RegisterBody;
  await sendSession(res, await authService.register({ email, password, name }), 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginBody;
  await sendSession(res, await authService.login({ email, password }), 200);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
  await sendSession(res, await authService.refreshSession(token), 200);
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(REFRESH_COOKIE, refreshCookieScope);
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getUserById(currentUser(req).id);
  const body: ApiResponse<UserDto> = { data: await authService.toUserDto(user) };
  res.status(200).json(body);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as ChangePasswordBody;
  await authService.changePassword(currentUser(req).id, currentPassword, newPassword);

  res.clearCookie(REFRESH_COOKIE, refreshCookieScope);
  res.status(204).send();
});
