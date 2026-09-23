import { Schema, model, Types, type HydratedDocument, type Model } from "mongoose";
import { FINE_PER_DAY, LOAN_PERIOD_DAYS } from "../../../shared/types";

export interface LoanAttrs {
  book: Types.ObjectId | null;
  member: Types.ObjectId | null;
  issuedAt: Date;
  dueDate: Date;
  returnedAt: Date | null;
  fineAmount: number;
  waivedAt: Date | null;
  waivedBy: Types.ObjectId | null;
  paidAt: Date | null;
  paidBy: Types.ObjectId | null;
}

export interface LoanVirtuals {
  isActive: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  daysUntilDue: number | null;
}

export type LoanDocument = HydratedDocument<LoanAttrs, LoanVirtuals>;
export type LoanModel = Model<
  LoanAttrs,
  Record<string, never>,
  Record<string, never>,
  LoanVirtuals,
  LoanDocument
>;

const loanSchema = new Schema<LoanAttrs, LoanModel, Record<string, never>, Record<string, never>, LoanVirtuals>(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", default: null, index: true },
    member: { type: Schema.Types.ObjectId, ref: "Member", default: null, index: true },
    issuedAt: { type: Date, required: true, default: () => new Date() },
    dueDate: {
      type: Date,
      required: true,
      default(this: LoanAttrs) {
        const issued = this.issuedAt ?? new Date();
        return new Date(issued.getTime() + LOAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      },
    },
    returnedAt: { type: Date, default: null },
    fineAmount: { type: Number, required: true, min: 0, default: 0 },
    paidAt: { type: Date, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    waivedAt: { type: Date, default: null },
    waivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

loanSchema.index({ book: 1, returnedAt: 1 });
loanSchema.index({ member: 1, returnedAt: 1 });

loanSchema.index(
  { member: 1, book: 1 },
  {
    unique: true,
    partialFilterExpression: { returnedAt: null, book: { $type: "objectId" } },
    name: "one_active_loan_per_member_per_book",
  }
);

loanSchema.virtual("isActive").get(function (this: LoanDocument) {
  return this.returnedAt === null;
});

loanSchema.virtual("daysOverdue").get(function (this: LoanDocument) {
  const endpoint = this.returnedAt ?? new Date();
  const msLate = endpoint.getTime() - this.dueDate.getTime();
  if (msLate <= 0) return 0;
  return Math.ceil(msLate / (24 * 60 * 60 * 1000));
});

loanSchema.virtual("isOverdue").get(function (this: LoanDocument) {
  return this.daysOverdue > 0;
});

loanSchema.virtual("daysUntilDue").get(function (this: LoanDocument): number | null {
  if (this.returnedAt !== null) return null;
  const msLeft = this.dueDate.getTime() - Date.now();
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
});

export const FINE_RATE_PER_DAY = FINE_PER_DAY;

export const Loan = model<LoanAttrs, LoanModel>("Loan", loanSchema);
