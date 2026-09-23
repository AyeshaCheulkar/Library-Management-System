import { Book, type BookDocument } from "../models/book.model";
import { Types } from "mongoose";
import { ConflictError, NotFoundError } from "../errors/AppError";
import { countAvailableCopies } from "./availability.service";

async function findBookOrFail(bookId: string): Promise<BookDocument> {
  const book = await Book.findById(bookId);
  if (!book) throw new NotFoundError("No such book");
  return book;
}

export async function reserve(bookId: string, memberId: string): Promise<BookDocument> {
  const book = await findBookOrFail(bookId);

  const available = await countAvailableCopies(book);
  if (available > 0) {
    throw new ConflictError("A copy is available - borrow it rather than reserving it");
  }

  const alreadyQueued = book.reservations.some(
    (reservation) => reservation.member.toString() === memberId
  );
  if (alreadyQueued) throw new ConflictError("You are already in the queue for this book");

  book.reservations.push({
    member: new Types.ObjectId(memberId),
    reservedAt: new Date(),
  });
  await book.save();
  return book;
}

export async function cancelReservation(bookId: string, memberId: string): Promise<void> {
  const book = await findBookOrFail(bookId);

  const before = book.reservations.length;
  book.reservations = book.reservations.filter(
    (reservation) => reservation.member.toString() !== memberId
  ) as typeof book.reservations;

  if (book.reservations.length === before) {
    throw new NotFoundError("You are not in the queue for this book");
  }

  await book.save();
}

export async function removeReservationOnIssue(
  bookId: Types.ObjectId,
  memberId: Types.ObjectId
): Promise<void> {
  await Book.updateOne(
    { _id: bookId },
    { $pull: { reservations: { member: memberId } } }
  );
}
