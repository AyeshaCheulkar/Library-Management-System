import { Schema, model, Types, type HydratedDocument, type Model } from "mongoose";
import { REQUEST_STATUSES, type RequestStatus } from "../../../shared/types";

export interface BookRequestAttrs {
  book: Types.ObjectId;
  member: Types.ObjectId;
  status: RequestStatus;
  requestedAt: Date;
  decidedBy: Types.ObjectId | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  loan: Types.ObjectId | null;
}

export type BookRequestDocument = HydratedDocument<BookRequestAttrs>;
export type BookRequestModel = Model<BookRequestAttrs>;

const requestSchema = new Schema<BookRequestAttrs, BookRequestModel>(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    status: { type: String, required: true, enum: REQUEST_STATUSES, default: "pending" },
    requestedAt: { type: Date, required: true, default: () => new Date() },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: null, maxlength: 200, trim: true },
    loan: { type: Schema.Types.ObjectId, ref: "Loan", default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

requestSchema.index({ status: 1, requestedAt: 1 });

requestSchema.index({ member: 1, status: 1 });

requestSchema.index(
  { member: 1, book: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "one_open_request_per_member_per_book",
  }
);

export const BookRequest = model<BookRequestAttrs, BookRequestModel>(
  "BookRequest",
  requestSchema
);
