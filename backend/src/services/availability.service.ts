import type { PipelineStage } from "mongoose";
import { Book, type BookDocument } from "../models/book.model";
import { Loan } from "../models/loan.model";
import { NotFoundError } from "../errors/AppError";
import type { BookAvailabilityDto } from "../../../shared/types";

export function countActiveLoans(bookId: BookDocument["_id"]): Promise<number> {
  return Loan.countDocuments({ book: bookId, returnedAt: null });
}

export async function countAvailableCopies(book: BookDocument): Promise<number> {
  const active = await countActiveLoans(book._id);
  return Math.max(0, book.copiesTotal - active);
}

export function hasAFreeCopyStages(): PipelineStage[] {
  return [
    {
      $lookup: {
        from: Loan.collection.name,
        let: { bookId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$book", "$$bookId"] }, { $eq: ["$returnedAt", null] }],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "__activeLoans",
      },
    },
    { $match: { $expr: { $gt: ["$copiesTotal", { $size: "$__activeLoans" }] } } },
    { $project: { __activeLoans: 0 } },
  ];
}

export async function getAvailability(bookId: string): Promise<BookAvailabilityDto> {
  const book = await Book.findById(bookId);
  if (!book) throw new NotFoundError("No such book");

  const activeLoans = await countActiveLoans(book._id);

  return {
    bookId: book._id.toString(),
    copiesTotal: book.copiesTotal,
    copiesAvailable: Math.max(0, book.copiesTotal - activeLoans),
    activeLoans,
    queueLength: book.reservations.length,
  };
}
