import { Book, type BookDocument } from "../models/book.model";
import { ConflictError, NotFoundError } from "../errors/AppError";
import { hasAFreeCopyStages } from "./availability.service";
import { applyDeletePolicy } from "./dependents.service";
import { withdrawRequestsForBook } from "./request.service";
import type {
  BookDto,
  BookListQuery,
  CategoryDto,
  CreateBookBody,
  DeletePolicy,
  Paginated,
  UpdateBookBody,
} from "../../../shared/types";

export function toBookDto(book: BookDocument): BookDto {
  return {
    id: book._id.toString(),
    isbn: book.isbn,
    title: book.title,
    author: book.author,
    category: book.category,
    copiesTotal: book.copiesTotal,
    coverUrl: book.coverImageUrl,
    isWithdrawn: book.isWithdrawn,
    reservations: book.reservations.map((reservation) => ({
      memberId: reservation.member.toString(),
      reservedAt: reservation.reservedAt.toISOString(),
    })),
  };
}

export async function listBooks(query: BookListQuery): Promise<Paginated<BookDto>> {
  const filter: Record<string, unknown> = {};

  if (query.search) filter.$text = { $search: query.search };
  if (query.category) filter.category = query.category;
  if (query.availableOnly) filter.isWithdrawn = { $ne: true };

  const skip = (query.page - 1) * query.pageSize;

  const [books, total] = query.availableOnly
    ? await findBooksWithAFreeCopy(filter, skip, query.pageSize)
    : await Promise.all([
        Book.find(filter).sort({ title: 1 }).skip(skip).limit(query.pageSize),
        Book.countDocuments(filter),
      ]);

  return {
    items: books.map(toBookDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

interface FacetedPage {
  items: Record<string, unknown>[];
  total: { n: number }[];
}

async function findBooksWithAFreeCopy(
  filter: Record<string, unknown>,
  skip: number,
  limit: number
): Promise<[BookDocument[], number]> {
  const [page] = await Book.aggregate<FacetedPage>([
    { $match: filter },
    ...hasAFreeCopyStages(),
    {
      $facet: {
        items: [{ $sort: { title: 1 } }, { $skip: skip }, { $limit: limit }],
        total: [{ $count: "n" }],
      },
    },
  ]);

  return [(page?.items ?? []).map((doc) => Book.hydrate(doc)), page?.total[0]?.n ?? 0];
}

export async function listCategories(): Promise<CategoryDto[]> {
  return Book.aggregate<CategoryDto>([
    {
      $group: {
        _id: "$category",
        bookCount: { $sum: 1 },
        copiesTotal: { $sum: "$copiesTotal" },
      },
    },
    { $project: { _id: 0, category: "$_id", bookCount: 1, copiesTotal: 1 } },
    { $sort: { category: 1 } },
  ]);
}

async function findBookOrFail(id: string): Promise<BookDocument> {
  const book = await Book.findById(id);
  if (!book) throw new NotFoundError("No such book");
  return book;
}

export async function getBook(id: string): Promise<BookDto> {
  return toBookDto(await findBookOrFail(id));
}

export async function createBook(input: CreateBookBody): Promise<BookDto> {
  if (await Book.exists({ isbn: input.isbn })) {
    throw new ConflictError("A book with that ISBN already exists");
  }
  return toBookDto(await Book.create(input));
}

export async function updateBook(id: string, patch: UpdateBookBody): Promise<BookDto> {
  const book = await findBookOrFail(id);

  if (patch.title !== undefined) book.title = patch.title;
  if (patch.author !== undefined) book.author = patch.author;
  if (patch.category !== undefined) book.category = patch.category;
  if (patch.copiesTotal !== undefined) book.copiesTotal = patch.copiesTotal;
  if (patch.isWithdrawn !== undefined) book.isWithdrawn = patch.isWithdrawn;

  await book.save();
  return toBookDto(book);
}

export async function deleteBook(id: string, policy: DeletePolicy): Promise<void> {
  const book = await findBookOrFail(id);

  await applyDeletePolicy({
    policy,
    reference: "book",
    id: book._id,
    describeBlocked: (activeLoans) =>
      `Cannot delete a book with ${activeLoans} active loan(s). Return them first.`,
  });

  await withdrawRequestsForBook(book._id.toString());

  await book.deleteOne();
}
