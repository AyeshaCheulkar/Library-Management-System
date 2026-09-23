import request from "supertest";
import app from "../src/app";
import { Book } from "../src/models/book.model";
import { Loan } from "../src/models/loan.model";
import { loginAs } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

const BOOK = {
  isbn: "9780132350884",
  title: "Clean Code",
  author: "Robert Martin",
  category: "software",
  copiesTotal: 5,
};

const shelve = (overrides: Partial<typeof BOOK> = {}) => Book.create({ ...BOOK, ...overrides });

async function lend(
  memberId: unknown,
  bookId: unknown,
  dueInDays: number,
  returnedAt: Date | null = null
) {
  return Loan.create({
    book: bookId,
    member: memberId,
    issuedAt: new Date(Date.now() - 14 * DAY),
    dueDate: new Date(Date.now() + dueInDays * DAY),
    returnedAt,
  });
}

describe("the day counts on a loan", () => {
  it("counts down while the loan is running", async () => {
    const member = await loginAs("member");
    const book = await shelve();
    await lend(member.member._id, book._id, 3.5);

    const response = await request(app)
      .get(`/api/members/${member.member._id}/loans`)
      .set(member.auth);

    const [loan] = response.body.data;
    expect(loan.daysUntilDue).toBe(4);
    expect(loan.daysOverdue).toBe(0);
    expect(loan.isOverdue).toBe(false);
  });

  it("counts up once the due date has passed, and stops counting down", async () => {
    const member = await loginAs("member");
    const book = await shelve();
    await lend(member.member._id, book._id, -6.5);

    const response = await request(app)
      .get(`/api/members/${member.member._id}/loans`)
      .set(member.auth);

    const [loan] = response.body.data;
    expect(loan.daysOverdue).toBe(7);
    expect(loan.daysUntilDue).toBe(0);
    expect(loan.isOverdue).toBe(true);
  });

  it("is the number the fine is computed from, so the row can show its working", async () => {
    const member = await loginAs("member");
    const book = await shelve();
    await lend(member.member._id, book._id, -6.5);

    const response = await request(app)
      .get(`/api/members/${member.member._id}/loans`)
      .set(member.auth);

    const [loan] = response.body.data;
    expect(loan.accruedFine).toBe(loan.daysOverdue * 5);
  });

  it("stops counting down once the book is back", async () => {
    const member = await loginAs("member");
    const book = await shelve();
    await lend(member.member._id, book._id, -6.5, new Date(Date.now() - 2 * DAY));

    const response = await request(app)
      .get(`/api/members/${member.member._id}/loans`)
      .set(member.auth);

    const [loan] = response.body.data;
    expect(loan.daysUntilDue).toBeNull();
    expect(loan.daysOverdue).toBe(5);
  });
});

describe("GET /api/loans", () => {
  it("shows staff every active loan with the book and the borrower on it", async () => {
    const staff = await loginAs("librarian");
    const alice = await loginAs("member");
    const bob = await loginAs("member");
    const one = await shelve({ isbn: "9780132350884", title: "Clean Code" });
    const two = await shelve({ isbn: "9780201616224", title: "Refactoring" });

    await lend(alice.member._id, one._id, 3.5);
    await lend(bob.member._id, two._id, 5.5);

    const response = await request(app).get("/api/loans").set(staff.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(2);
    const rows = response.body.data.items;
    expect(rows[0].book.title).toBeDefined();
    expect(rows[0].member.name).toBeDefined();
  });

  it("sorts most overdue first, because that is the order the work needs doing", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const late = await shelve({ isbn: "9780132350884", title: "Very Late" });
    const soon = await shelve({ isbn: "9780201616224", title: "Due Soon" });
    const later = await shelve({ isbn: "9780262033848", title: "Due Later" });

    await lend(member.member._id, soon._id, 2.5);
    await lend(member.member._id, late._id, -9.5);
    await lend(member.member._id, later._id, 20.5);

    const response = await request(app).get("/api/loans").set(staff.auth);

    expect(response.body.data.items.map((l: { book: { title: string } }) => l.book.title)).toEqual([
      "Very Late",
      "Due Soon",
      "Due Later",
    ]);
  });

  it("excludes returned loans from the active view", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const out = await shelve({ isbn: "9780132350884", title: "Still Out" });
    const back = await shelve({ isbn: "9780201616224", title: "Came Back" });

    await lend(member.member._id, out._id, 3.5);
    await lend(member.member._id, back._id, -1.5, new Date());

    const response = await request(app).get("/api/loans").set(staff.auth);

    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items[0].book.title).toBe("Still Out");
  });

  it("?view=overdue filters in the database, so the total counts overdue not fetched", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");

    for (let i = 0; i < 8; i += 1) {
      const book = await shelve({ isbn: `978013235${1000 + i}`, title: `Book ${i}` });
      await lend(member.member._id, book._id, i < 5 ? -(i + 1.5) : i + 1.5);
    }

    const response = await request(app)
      .get("/api/loans?view=overdue&page=1&pageSize=2")
      .set(staff.auth);

    expect(response.body.data.total).toBe(5);
    expect(response.body.data.items).toHaveLength(2);
    expect(
      response.body.data.items.every((l: { isOverdue: boolean }) => l.isOverdue)
    ).toBe(true);
  });

  it("?view=all includes returned loans", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const out = await shelve({ isbn: "9780132350884" });
    const back = await shelve({ isbn: "9780201616224" });
    await lend(member.member._id, out._id, 3.5);
    await lend(member.member._id, back._id, -1.5, new Date());

    const response = await request(app).get("/api/loans?view=all").set(staff.auth);
    expect(response.body.data.total).toBe(2);
  });

  it("falls back to the active view for a nonsense view rather than erroring", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const book = await shelve();
    await lend(member.member._id, book._id, 3.5);

    const response = await request(app).get("/api/loans?view=everything").set(staff.auth);
    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(1);
  });

  it("refuses a member with 403 - who borrows what is the desk's business", async () => {
    const member = await loginAs("member");
    const response = await request(app).get("/api/loans").set(member.auth);
    expect(response.status).toBe(403);
  });

  it("refuses an anonymous caller with 401", async () => {
    expect((await request(app).get("/api/loans")).status).toBe(401);
  });
});
