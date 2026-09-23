import request from "supertest";
import app from "../src/app";
import { Book } from "../src/models/book.model";
import { Loan } from "../src/models/loan.model";
import { FINE_PER_DAY, LOAN_PERIOD_DAYS } from "../../shared/types";
import { loginAs, type Actor } from "./helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createBook(
  librarian: Actor,
  overrides: Partial<{ isbn: string; title: string; copiesTotal: number }> = {}
): Promise<string> {
  const response = await request(app)
    .post("/api/books")
    .set(librarian.auth)
    .send({
      isbn: overrides.isbn ?? "978-0-13-235088-4",
      title: overrides.title ?? "Clean Code",
      author: "Robert Martin",
      category: "software",
      copiesTotal: overrides.copiesTotal ?? 1,
    });
  return response.body.data.id as string;
}

describe("derived availability", () => {
  it("derives copiesAvailable as copiesTotal minus active loans", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bob = await loginAs("member");
    const bookId = await createBook(librarian, { copiesTotal: 3 });

    const before = await request(app).get(`/api/books/${bookId}/availability`).set(librarian.auth);
    expect(before.body.data.copiesAvailable).toBe(3);
    expect(before.body.data.activeLoans).toBe(0);

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });
    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: bob.member.id });

    const after = await request(app).get(`/api/books/${bookId}/availability`).set(librarian.auth);
    expect(after.body.data.copiesAvailable).toBe(1);
    expect(after.body.data.activeLoans).toBe(2);
  });

  it("returns the copy to circulation the moment it is returned", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian, { copiesTotal: 1 });

    const issued = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    const whileOut = await request(app)
      .get(`/api/books/${bookId}/availability`)
      .set(librarian.auth);
    expect(whileOut.body.data.copiesAvailable).toBe(0);

    await request(app)
      .patch(`/api/loans/${issued.body.data.id}/return`)
      .set(librarian.auth);

    const afterReturn = await request(app)
      .get(`/api/books/${bookId}/availability`)
      .set(librarian.auth);
    expect(afterReturn.body.data.copiesAvailable).toBe(1);
  });

  it("never reports negative availability when copiesTotal is cut below what is out", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian, { copiesTotal: 2 });

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });
    await request(app).patch(`/api/books/${bookId}`).set(librarian.auth).send({ copiesTotal: 0 });

    const response = await request(app)
      .get(`/api/books/${bookId}/availability`)
      .set(librarian.auth);
    expect(response.body.data.copiesAvailable).toBe(0);
  });
});

describe("issuing a loan", () => {
  it("returns 409 when issuing a book with no copy available", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bob = await loginAs("member");
    const bookId = await createBook(librarian, { copiesTotal: 1 });

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    const response = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: bob.member.id });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("returns 422 when the member is over their borrow limit", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member", { membershipType: "standard" });

    for (let i = 0; i < 3; i += 1) {
      const bookId = await createBook(librarian, {
        isbn: `97800000000${i}0`,
        title: `Book ${i}`,
      });
      const issued = await request(app)
        .post("/api/loans")
        .set(librarian.auth)
        .send({ bookId, memberId: alice.member.id });
      expect(issued.status).toBe(201);
    }

    const fourth = await createBook(librarian, { isbn: "9788888888888", title: "One Too Many" });
    const response = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId: fourth, memberId: alice.member.id });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("UNPROCESSABLE");
  });

  it("scales the limit with the membership type rather than a stored number", async () => {
    const librarian = await loginAs("librarian");
    const faculty = await loginAs("member", { membershipType: "faculty" });

    for (let i = 0; i < 4; i += 1) {
      const bookId = await createBook(librarian, {
        isbn: `97811111111${i}0`,
        title: `Book ${i}`,
      });
      const issued = await request(app)
        .post("/api/loans")
        .set(librarian.auth)
        .send({ bookId, memberId: faculty.member.id });
      expect(issued.status).toBe(201);
    }
  });

  it("sets a due date one loan period out", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);

    const response = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    const issuedAt = new Date(response.body.data.issuedAt).getTime();
    const dueDate = new Date(response.body.data.dueDate).getTime();
    expect(Math.round((dueDate - issuedAt) / DAY_MS)).toBe(LOAN_PERIOD_DAYS);
  });

  it("refuses a second active loan of the same title to the same member", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian, { copiesTotal: 5 });

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    const second = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    expect(second.status).toBe(409);
    expect(await Loan.countDocuments({ member: alice.member._id, returnedAt: null })).toBe(1);
  });

  it("lets the same member borrow the same title again once returned", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);

    const first = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });
    await request(app).patch(`/api/loans/${first.body.data.id}/return`).set(librarian.auth);

    const again = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    expect(again.status).toBe(201);
  });

  it("returns 404 for an unknown book or member, and 403 for a member issuing to themselves", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);
    const missing = "507f1f77bcf86cd799439011";

    expect(
      (
        await request(app)
          .post("/api/loans")
          .set(librarian.auth)
          .send({ bookId: missing, memberId: alice.member.id })
      ).status
    ).toBe(404);

    expect(
      (
        await request(app)
          .post("/api/loans")
          .set(librarian.auth)
          .send({ bookId, memberId: missing })
      ).status
    ).toBe(404);

    expect(
      (
        await request(app)
          .post("/api/loans")
          .set(alice.auth)
          .send({ bookId, memberId: alice.member.id })
      ).status
    ).toBe(403);
  });
});

describe("fines", () => {
  it("computes the fine on return", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);

    const loan = await Loan.create({
      book: bookId,
      member: alice.member._id,
      issuedAt: new Date(Date.now() - 19.5 * DAY_MS),
      dueDate: new Date(Date.now() - 5.5 * DAY_MS),
    });

    const response = await request(app)
      .patch(`/api/loans/${loan.id}/return`)
      .set(librarian.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.fineAmount).toBe(6 * FINE_PER_DAY);
    expect(response.body.data.returnedAt).not.toBeNull();
  });

  it("settles nothing for a book returned on time", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);

    const issued = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    const response = await request(app)
      .patch(`/api/loans/${issued.body.data.id}/return`)
      .set(librarian.auth);

    expect(response.body.data.fineAmount).toBe(0);
  });

  it("reports an accrued fine on an active overdue loan, while fineAmount stays zero", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);

    await Loan.create({
      book: bookId,
      member: alice.member._id,
      issuedAt: new Date(Date.now() - 17.5 * DAY_MS),
      dueDate: new Date(Date.now() - 3.5 * DAY_MS),
    });

    const response = await request(app)
      .get(`/api/members/${alice.member.id}/loans`)
      .set(alice.auth);

    const row = response.body.data[0];
    expect(row.fineAmount).toBe(0);
    expect(row.accruedFine).toBe(4 * FINE_PER_DAY);
    expect(row.isOverdue).toBe(true);
  });

  it("returns 409 on returning a loan twice", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);

    const issued = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    await request(app).patch(`/api/loans/${issued.body.data.id}/return`).set(librarian.auth);
    const again = await request(app)
      .patch(`/api/loans/${issued.body.data.id}/return`)
      .set(librarian.auth);

    expect(again.status).toBe(409);
  });
});

describe("waiving a fine", () => {
  async function overdueReturnedLoan(librarian: Actor, alice: Actor): Promise<string> {
    const bookId = await createBook(librarian);
    const loan = await Loan.create({
      book: bookId,
      member: alice.member._id,
      issuedAt: new Date(Date.now() - 19.5 * DAY_MS),
      dueDate: new Date(Date.now() - 5.5 * DAY_MS),
    });
    await request(app).patch(`/api/loans/${loan.id}/return`).set(librarian.auth);
    return loan.id as string;
  }

  it("lets a librarian waive a settled fine and records who did it", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const loanId = await overdueReturnedLoan(librarian, alice);

    const response = await request(app)
      .patch(`/api/loans/${loanId}/waive-fine`)
      .set(librarian.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.fineAmount).toBe(0);
    expect(response.body.data.waivedAt).not.toBeNull();

    const stored = await Loan.findById(loanId);
    expect(stored?.waivedBy?.toString()).toBe(librarian.user._id.toString());
  });

  it("refuses a member waiving their own fine", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const loanId = await overdueReturnedLoan(librarian, alice);

    const response = await request(app)
      .patch(`/api/loans/${loanId}/waive-fine`)
      .set(alice.auth);

    expect(response.status).toBe(403);
    const stored = await Loan.findById(loanId);
    expect(stored?.fineAmount).toBe(6 * FINE_PER_DAY);
  });

  it("gives a member no route to write fineAmount at all", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const loanId = await overdueReturnedLoan(librarian, alice);

    const direct = await request(app)
      .patch(`/api/loans/${loanId}`)
      .set(alice.auth)
      .send({ fineAmount: 0 });

    expect(direct.status).toBe(404);
    const stored = await Loan.findById(loanId);
    expect(stored?.fineAmount).toBe(6 * FINE_PER_DAY);
  });

  it("returns 409 when there is nothing to waive, or the book is still out", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);

    const issued = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    const stillOut = await request(app)
      .patch(`/api/loans/${issued.body.data.id}/waive-fine`)
      .set(librarian.auth);
    expect(stillOut.status).toBe(409);

    await request(app).patch(`/api/loans/${issued.body.data.id}/return`).set(librarian.auth);
    const noFine = await request(app)
      .patch(`/api/loans/${issued.body.data.id}/waive-fine`)
      .set(librarian.auth);
    expect(noFine.status).toBe(409);
  });
});

describe("the reservation queue lifecycle", () => {
  it("refuses a reservation while a copy is on the shelf", async () => {
    const alice = await loginAs("member");
    const librarian = await loginAs("librarian");
    const bookId = await createBook(librarian, { copiesTotal: 1 });

    const response = await request(app).post(`/api/books/${bookId}/reserve`).set(alice.auth);

    expect(response.status).toBe(409);
  });

  it("lets a member join the queue once every copy is out", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bob = await loginAs("member");
    const bookId = await createBook(librarian, { copiesTotal: 1 });

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    const response = await request(app).post(`/api/books/${bookId}/reserve`).set(bob.auth);
    expect(response.status).toBe(201);

    const availability = await request(app)
      .get(`/api/books/${bookId}/availability`)
      .set(bob.auth);
    expect(availability.body.data.queueLength).toBe(1);
    expect(availability.body.data.copiesAvailable).toBe(0);
  });

  it("refuses a duplicate reservation, so queueLength stays truthful", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bob = await loginAs("member");
    const bookId = await createBook(librarian, { copiesTotal: 1 });

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });
    await request(app).post(`/api/books/${bookId}/reserve`).set(bob.auth);

    const duplicate = await request(app).post(`/api/books/${bookId}/reserve`).set(bob.auth);

    expect(duplicate.status).toBe(409);
    const book = await Book.findById(bookId);
    expect(book?.reservations).toHaveLength(1);
  });

  it("removes the reservation automatically when that member is issued the book", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bob = await loginAs("member");
    const bookId = await createBook(librarian, { copiesTotal: 1 });

    const alicesLoan = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });
    await request(app).post(`/api/books/${bookId}/reserve`).set(bob.auth);
    expect((await Book.findById(bookId))?.reservations).toHaveLength(1);

    await request(app).patch(`/api/loans/${alicesLoan.body.data.id}/return`).set(librarian.auth);
    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: bob.member.id });

    expect((await Book.findById(bookId))?.reservations).toHaveLength(0);
  });

  it("lets a member leave the queue voluntarily", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bob = await loginAs("member");
    const bookId = await createBook(librarian, { copiesTotal: 1 });

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });
    await request(app).post(`/api/books/${bookId}/reserve`).set(bob.auth);

    const cancelled = await request(app)
      .delete(`/api/books/${bookId}/reserve`)
      .set(bob.auth);
    expect(cancelled.status).toBe(204);
    expect((await Book.findById(bookId))?.reservations).toHaveLength(0);

    expect((await request(app).delete(`/api/books/${bookId}/reserve`).set(bob.auth)).status).toBe(
      404
    );
  });
});

describe("delete with dependents - all three policies", () => {
  async function bookWithActiveLoan(): Promise<{
    librarian: Actor;
    admin: Actor;
    alice: Actor;
    bookId: string;
  }> {
    const librarian = await loginAs("librarian");
    const admin = await loginAs("admin");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    return { librarian, admin, alice, bookId };
  }

  it("blocks deleting a book with active loans when onDelete=block", async () => {
    const { librarian, bookId } = await bookWithActiveLoan();

    const response = await request(app)
      .delete(`/api/books/${bookId}?onDelete=block`)
      .set(librarian.auth);

    expect(response.status).toBe(409);
    expect(await Book.countDocuments()).toBe(1);
    expect(await Loan.countDocuments()).toBe(1);
  });

  it("defaults to block when no policy is given", async () => {
    const { librarian, bookId } = await bookWithActiveLoan();

    const response = await request(app).delete(`/api/books/${bookId}`).set(librarian.auth);

    expect(response.status).toBe(409);
  });

  it("destroys the borrowing record when onDelete=cascade", async () => {
    const { librarian, bookId } = await bookWithActiveLoan();

    const response = await request(app)
      .delete(`/api/books/${bookId}?onDelete=cascade`)
      .set(librarian.auth);

    expect(response.status).toBe(204);
    expect(await Book.countDocuments()).toBe(0);
    expect(await Loan.countDocuments()).toBe(0);
  });

  it("keeps the loan but orphans it when onDelete=nullify", async () => {
    const { librarian, alice, bookId } = await bookWithActiveLoan();

    const response = await request(app)
      .delete(`/api/books/${bookId}?onDelete=nullify`)
      .set(librarian.auth);

    expect(response.status).toBe(204);
    expect(await Loan.countDocuments()).toBe(1);

    const orphan = await Loan.findOne({ member: alice.member._id });
    expect(orphan?.book).toBeNull();

    const rows = await request(app)
      .get(`/api/members/${alice.member.id}/loans`)
      .set(alice.auth);
    expect(rows.body.data).toHaveLength(1);
    expect(rows.body.data[0].book).toBeNull();
  });

  it("rejects an unknown policy with 400 rather than silently blocking", async () => {
    const { librarian, bookId } = await bookWithActiveLoan();

    const response = await request(app)
      .delete(`/api/books/${bookId}?onDelete=obliterate`)
      .set(librarian.auth);

    expect(response.status).toBe(400);
  });

  it("applies the same three policies to members", async () => {
    const { admin, alice } = await bookWithActiveLoan();

    const blocked = await request(app)
      .delete(`/api/members/${alice.member.id}?onDelete=block`)
      .set(admin.auth);
    expect(blocked.status).toBe(409);

    const nullified = await request(app)
      .delete(`/api/members/${alice.member.id}?onDelete=nullify`)
      .set(admin.auth);
    expect(nullified.status).toBe(204);
    expect(await Loan.countDocuments()).toBe(1);
    expect((await Loan.findOne({}))?.member).toBeNull();
  });
});

describe("the loan list - selective population and the IDOR", () => {
  it("populates only the fields a row renders, not whole documents", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bookId = await createBook(librarian);

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: alice.member.id });

    const response = await request(app)
      .get(`/api/members/${alice.member.id}/loans`)
      .set(alice.auth);

    const row = response.body.data[0];
    expect(row.book.title).toBe("Clean Code");
    expect(row.member.name).toBe(alice.member.name);
    expect(row.member.email).toBeUndefined();
    expect(row.member.membershipType).toBeUndefined();
    expect(row.book.category).toBeUndefined();
  });

  it("stays smaller than an unconstrained populate would be", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");

    for (let i = 0; i < 8; i += 1) {
      const bookId = await createBook(librarian, {
        isbn: `97833333333${i}0`,
        title: `A Reasonably Typical Book Title ${i}`,
      });
      await request(app)
        .post("/api/loans")
        .set(librarian.auth)
        .send({ bookId, memberId: alice.member.id });
    }

    const response = await request(app)
      .get(`/api/members/${alice.member.id}/loans`)
      .set(alice.auth);

    const unconstrained = await Loan.find({ member: alice.member._id })
      .populate("book")
      .populate("member");

    const served = Buffer.byteLength(JSON.stringify(response.body.data), "utf8");
    const naive = Buffer.byteLength(JSON.stringify(unconstrained), "utf8");

    expect(served).toBeLessThan(naive);
  });

  it("filters to active loans with ?active=true", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const first = await createBook(librarian, { isbn: "9780132350884", title: "A" });
    const second = await createBook(librarian, { isbn: "9780262033848", title: "B" });

    const issued = await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId: first, memberId: alice.member.id });
    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId: second, memberId: alice.member.id });
    await request(app).patch(`/api/loans/${issued.body.data.id}/return`).set(librarian.auth);

    const all = await request(app)
      .get(`/api/members/${alice.member.id}/loans`)
      .set(alice.auth);
    expect(all.body.data).toHaveLength(2);

    const active = await request(app)
      .get(`/api/members/${alice.member.id}/loans?active=true`)
      .set(alice.auth);
    expect(active.body.data).toHaveLength(1);
    expect(active.body.data[0].book.title).toBe("B");
  });

  it("returns 403 - not another member's history - for the IDOR case", async () => {
    const librarian = await loginAs("librarian");
    const alice = await loginAs("member");
    const bob = await loginAs("member");
    const bookId = await createBook(librarian);

    await request(app)
      .post("/api/loans")
      .set(librarian.auth)
      .send({ bookId, memberId: bob.member.id });

    const response = await request(app)
      .get(`/api/members/${bob.member.id}/loans`)
      .set(alice.auth);

    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain("Clean Code");
  });

  it("lets a librarian read any member's loans", async () => {
    const librarian = await loginAs("librarian");
    const bob = await loginAs("member");

    const response = await request(app)
      .get(`/api/members/${bob.member.id}/loans`)
      .set(librarian.auth);

    expect(response.status).toBe(200);
  });
});
