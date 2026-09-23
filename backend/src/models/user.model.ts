import bcrypt from "bcrypt";
import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import { ROLES, type Role } from "../../../shared/types";
import { env } from "../config/env";

const BCRYPT_COST = env.bcryptCost;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserAttrs {
  email: string;
  passwordHash: string;
  role: Role;
  refreshTokenVersion: number;
  isActive: boolean;
  lastLoginAt: Date | null;
}

export interface UserMethods {
  verifyPassword(plainText: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<UserAttrs, UserMethods>;
export type UserModel = Model<UserAttrs, Record<string, never>, UserMethods>;

const userSchema = new Schema<UserAttrs, UserModel, UserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_PATTERN, "Not a valid email address"],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ROLES,
      default: "member",
    },
    refreshTokenVersion: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("passwordHash")) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_COST);
});

userSchema.set("toJSON", {
  virtuals: true,
  transform(_doc, ret) {
    const safe = ret as unknown as Record<string, unknown>;
    delete safe.passwordHash;
    delete safe.__v;
    return safe;
  },
});

userSchema.methods.verifyPassword = function (this: UserDocument, plainText: string) {
  return bcrypt.compare(plainText, this.passwordHash);
};

export const User = model<UserAttrs, UserModel>("User", userSchema);
