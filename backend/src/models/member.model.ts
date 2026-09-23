import { Schema, model, Types, type HydratedDocument, type Model } from "mongoose";
import {
  BORROW_LIMITS,
  MEMBERSHIP_TYPES,
  type MembershipType,
} from "../../../shared/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface MemberAttrs {
  name: string;
  email: string;
  membershipType: MembershipType;
  joinedAt: Date;
  user: Types.ObjectId | null;
}

export interface MemberVirtuals {
  borrowLimit: number;
}

export type MemberDocument = HydratedDocument<MemberAttrs, MemberVirtuals>;
export type MemberModel = Model<
  MemberAttrs,
  Record<string, never>,
  Record<string, never>,
  MemberVirtuals,
  MemberDocument
>;

const memberSchema = new Schema<MemberAttrs, MemberModel, Record<string, never>, Record<string, never>, MemberVirtuals>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_PATTERN, "Not a valid email address"],
    },
    membershipType: {
      type: String,
      required: true,
      enum: MEMBERSHIP_TYPES,
      default: "standard",
    },
    joinedAt: { type: Date, required: true, default: () => new Date() },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

memberSchema.virtual("borrowLimit").get(function (this: MemberDocument) {
  return BORROW_LIMITS[this.membershipType];
});

export const Member = model<MemberAttrs, MemberModel>("Member", memberSchema);
