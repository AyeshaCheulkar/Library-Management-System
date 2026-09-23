import { Schema, model, Types, type HydratedDocument, type Model } from "mongoose";

export interface ReservationAttrs {
  member: Types.ObjectId;
  reservedAt: Date;
}

export interface BookAttrs {
  isbn: string;
  title: string;
  author: string;
  category: string;
  copiesTotal: number;
  coverUrl?: string;
  isWithdrawn: boolean;
  reservations: Types.DocumentArray<ReservationAttrs> | ReservationAttrs[];
}

export interface BookVirtuals {
  coverImageUrl: string | null;
}

export type BookDocument = HydratedDocument<BookAttrs, BookVirtuals>;
export type BookModel = Model<BookAttrs, {}, {}, BookVirtuals>;

const reservationSchema = new Schema<ReservationAttrs>(
  {
    member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    reservedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false }
);

function deriveCoverUrl(isbn: string): string | null {
  const digits = isbn.replace(/[^0-9Xx]/g, "");
  if (digits.length !== 10 && digits.length !== 13) return null;
  return `https://covers.openlibrary.org/b/isbn/${digits}-L.jpg?default=false`;
}

const bookSchema = new Schema<BookAttrs, BookModel, {}, {}, BookVirtuals>(
  {
    isbn: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^(?:\d[- ]?){9}[\dXx]$|^(?:\d[- ]?){12}\d$/, "Not a valid ISBN"],
    },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    author: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, index: true },
    copiesTotal: { type: Number, required: true, min: 0, default: 1 },
    coverUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      match: [/^https:\/\/\S+$/, "Must be an https URL"],
    },
    isWithdrawn: { type: Boolean, required: true, default: false },
    reservations: { type: [reservationSchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

bookSchema.virtual("coverImageUrl").get(function (this: BookAttrs): string | null {
  return this.coverUrl ?? deriveCoverUrl(this.isbn);
});

bookSchema.index({ title: "text", author: "text" });

export const Book = model<BookAttrs, BookModel>("Book", bookSchema);
