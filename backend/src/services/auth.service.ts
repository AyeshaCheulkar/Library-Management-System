import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User, type UserDocument } from "../models/user.model";
import { Member } from "../models/member.model";
import { findMemberIdForUser } from "./member.service";
import { env } from "../config/env";
import {
  AuthenticationError,
  ConflictError,
  ForbiddenError,
  UnprocessableError,
} from "../errors/AppError";
import { MIN_PASSWORD_LENGTH, type Role, type UserDto } from "../../../shared/types";

const LOGIN_FAILED = "Invalid email or password";

const dummyHash = bcrypt.hash("timing-equalisation-dummy", env.bcryptCost);

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  ver: number;
}

interface RefreshTokenPayload {
  sub: string;
  ver: number;
}

export async function toUserDto(user: UserDocument): Promise<UserDto> {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    memberId: await findMemberIdForUser(user._id.toString()),
  };
}

export function issueAccessToken(user: UserDocument): string {
  const payload: AccessTokenPayload = {
    sub: user._id.toString(),
    role: user.role,
    ver: user.refreshTokenVersion,
  };
  return jwt.sign(payload, env.accessTokenSecret, {
    expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"],
  });
}

export function issueRefreshToken(user: UserDocument): string {
  const payload: RefreshTokenPayload = {
    sub: user._id.toString(),
    ver: user.refreshTokenVersion,
  };
  return jwt.sign(payload, env.refreshTokenSecret, {
    expiresIn: env.refreshTokenTtl as jwt.SignOptions["expiresIn"],
  });
}

function verify<T>(token: string, secret: string): T {
  try {
    return jwt.verify(token, secret) as T;
  } catch {
    throw new AuthenticationError("Invalid or expired token");
  }
}

export async function resolveTokenSubject(payload: {
  sub: string;
  ver: number;
}): Promise<UserDocument> {
  const user = await User.findById(payload.sub);

  if (!user) throw new AuthenticationError("Invalid or expired token");

  if (user.refreshTokenVersion !== payload.ver) {
    throw new AuthenticationError("Session has been revoked, please log in again");
  }

  if (!user.isActive) throw new ForbiddenError("This account has been deactivated");

  return user;
}

export async function getUserById(userId: string): Promise<UserDocument> {
  const user = await User.findById(userId);
  if (!user) throw new AuthenticationError("Invalid or expired token");
  return user;
}

export function verifyAccessToken(token: string): Promise<UserDocument> {
  return resolveTokenSubject(verify<AccessTokenPayload>(token, env.accessTokenSecret));
}

export function verifyRefreshToken(token: string): Promise<UserDocument> {
  return resolveTokenSubject(verify<RefreshTokenPayload>(token, env.refreshTokenSecret));
}

function assertPasswordIsStrongEnough(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new UnprocessableError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
}

export interface Session {
  user: UserDocument;
  accessToken: string;
  refreshToken: string;
}

function startSession(user: UserDocument): Session {
  return {
    user,
    accessToken: issueAccessToken(user),
    refreshToken: issueRefreshToken(user),
  };
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
}): Promise<Session> {
  const email = input.email.toLowerCase();
  assertPasswordIsStrongEnough(input.password);

  if (await User.exists({ email })) {
    throw new ConflictError("That email is already registered");
  }

  const user = await User.create({ email, passwordHash: input.password, role: "member" });

  const existingMember = await Member.findOne({ email, user: null });
  if (existingMember) {
    existingMember.user = user._id;
    await existingMember.save();
  } else {
    await Member.create({ name: input.name, email, user: user._id });
  }

  return startSession(user);
}

export async function login(input: { email: string; password: string }): Promise<Session> {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select("+passwordHash");

  if (!user) {
    await bcrypt.compare(input.password, await dummyHash);
    throw new AuthenticationError(LOGIN_FAILED);
  }

  if (!(await user.verifyPassword(input.password))) {
    throw new AuthenticationError(LOGIN_FAILED);
  }

  if (!user.isActive) throw new ForbiddenError("This account has been deactivated");

  user.lastLoginAt = new Date();
  await user.save();

  return startSession(user);
}

export async function refreshSession(refreshToken: string | undefined): Promise<Session> {
  if (!refreshToken) throw new AuthenticationError("No refresh token provided");
  return startSession(await verifyRefreshToken(refreshToken));
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new AuthenticationError("Invalid or expired token");

  if (!(await user.verifyPassword(currentPassword))) {
    throw new AuthenticationError("Current password is incorrect");
  }

  assertPasswordIsStrongEnough(newPassword);

  user.passwordHash = newPassword;
  user.refreshTokenVersion += 1;
  await user.save();
}
