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
  copiesTotal: 2,
};

const shelve = (overrides: Partial<typeof BOOK> & { isWithdrawn?: boolean } = {}) =>
  Book.create({ ...BOOK, ...overrides });

describe("withdrawing a title from lending", () => {
  it("is a librarian's decision, made through the normal update", async () => {
    const staff = await loginAs("librarian");
    const book = await shelve();

    const response = await request(app)
      .patch(`/api/books/${book._id}`)
      .set(staff.auth)
      .send({ isWithdrawn: true });

    expect(response.status).toBe(200);
    expect(response.body.data.isWithdrawn).toBe(true);
  });

  it("refuses to issue it, even though copies are physically free", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const book = await shelve({ isWithdrawn: true });

    const response = await request(app)
      .post("/api/loans")
      .set(staff.auth)
      .send({ bookId: book._id.toString(), memberId: member.member._id.toString() });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("This title has been withdrawn from lending");
    expect(await Loan.countDocuments()).toBe(0);
  });

  it("refuses a request for it, rather than queueing one a librarian must decline", async () => {
    const member = await loginAs("member");
    const book = await shelve({ isWithdrawn: true });

    const response = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: book._id.toString() });

    expect(response.status).toBe(409);
  });

  it("stays in the catalogue - withdrawn is not deleted", async () => {
    const staff = await loginAs("librarian");
    const book = await shelve({ isWithdrawn: true });

    const listed = await request(app).get("/api/books").set(staff.auth);
    expect(listed.body.data.items.map((b: { id: string }) => b.id)).toContain(
      book._id.toString()
    );
  });

  it("is excluded from ?available=true, because available means borrowable", async () => {
    const staff = await loginAs("librarian");
    await shelve({ isbn: "9780132350884", title: "Lendable" });
    await shelve({ isbn: "9780201616224", title: "Withdrawn", isWithdrawn: true });

    const response = await request(app).get("/api/books?available=true").set(staff.auth);

    expect(response.body.data.items.map((b: { title: string }) => b.title)).toEqual([
      "Lendable",
    ]);
  });

  it("lets outstanding loans run to completion and settle normally", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const book = await shelve();
    const loan = await Loan.create({
      book: book._id,
      member: member.member._id,
      dueDate: new Date(Date.now() - 3.5 * DAY),
    });

    await request(app).patch(`/api/books/${book._id}`).set(staff.auth).send({ isWithdrawn: true });

    const returned = await request(app)
      .patch(`/api/loans/${loan._id}/return`)
      .set(staff.auth);

    expect(returned.status).toBe(200);
    expect(returned.body.data.fineAmount).toBe(20);
  });

  it("can be put back on the shelf", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const book = await shelve({ isWithdrawn: true });

    await request(app).patch(`/api/books/${book._id}`).set(staff.auth).send({ isWithdrawn: false });

    const issued = await request(app)
      .post("/api/loans")
      .set(staff.auth)
      .send({ bookId: book._id.toString(), memberId: member.member._id.toString() });

    expect(issued.status).toBe(201);
  });

  it("refuses a member trying to withdraw a book", async () => {
    const member = await loginAs("member");
    const book = await shelve();

    const response = await request(app)
      .patch(`/api/books/${book._id}`)
      .set(member.auth)
      .send({ isWithdrawn: true });

    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/loans/:id/pay", () => {
  async function overdueAndBack() {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const book = await shelve();
    const loan = await Loan.create({
      book: book._id,
      member: member.member._id,
      dueDate: new Date(Date.now() - 6.5 * DAY),
    });
    await request(app).patch(`/api/loans/${loan._id}/return`).set(staff.auth);
    return { staff, member, loan };
  }

  it("records the payment WITHOUT touching what was owed", async () => {
    const { staff, loan } = await overdueAndBack();

    const response = await request(app).patch(`/api/loans/${loan._id}/pay`).set(staff.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.paidAt).toBeTruthy();
    expect(response.body.data.fineAmount).toBe(35);

    const stored = await Loan.findById(loan._id);
    expect(stored?.fineAmount).toBe(35);
    expect(stored?.paidBy?.toString()).toBe(staff.user._id.toString());
  });

  it("refuses to take the same money twice", async () => {
    const { staff, loan } = await overdueAndBack();
    await request(app).patch(`/api/loans/${loan._id}/pay`).set(staff.auth);

    const again = await request(app).patch(`/api/loans/${loan._id}/pay`).set(staff.auth);
    expect(again.status).toBe(409);
  });

  it("refuses while the book is still out - a fine is not settled until it comes back", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const book = await shelve();
    const loan = await Loan.create({
      book: book._id,
      member: member.member._id,
      dueDate: new Date(Date.now() - 6.5 * DAY),
    });

    const response = await request(app).patch(`/api/loans/${loan._id}/pay`).set(staff.auth);
    expect(response.status).toBe(409);
  });

  it("refuses a loan that never owed anything", async () => {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const book = await shelve();
    const loan = await Loan.create({
      book: book._id,
      member: member.member._id,
      dueDate: new Date(Date.now() + 5 * DAY),
    });
    await request(app).patch(`/api/loans/${loan._id}/return`).set(staff.auth);

    const response = await request(app).patch(`/api/loans/${loan._id}/pay`).set(staff.auth);
    expect(response.status).toBe(409);
  });

  it("refuses a member with 403 - a borrower cannot mark their own fine paid", async () => {
    const { member, loan } = await overdueAndBack();
    const response = await request(app).patch(`/api/loans/${loan._id}/pay`).set(member.auth);
    expect(response.status).toBe(403);
  });
});

describe("paying and waiving are mutually exclusive", () => {
  async function settledFine() {
    const staff = await loginAs("librarian");
    const member = await loginAs("member");
    const book = await shelve();
    const loan = await Loan.create({
      book: book._id,
      member: member.member._id,
      dueDate: new Date(Date.now() - 6.5 * DAY),
    });
    await request(app).patch(`/api/loans/${loan._id}/return`).set(staff.auth);
    return { staff, loan };
  }

  it("cannot waive money that has already been taken", async () => {
    const { staff, loan } = await settledFine();
    await request(app).patch(`/api/loans/${loan._id}/pay`).set(staff.auth);

    const waived = await request(app).patch(`/api/loans/${loan._id}/waive-fine`).set(staff.auth);

    expect(waived.status).toBe(409);
    expect((await Loan.findById(loan._id))?.fineAmount).toBe(35);
  });

  it("cannot pay a fine that has been forgiven", async () => {
    const { staff, loan } = await settledFine();
    await request(app).patch(`/api/loans/${loan._id}/waive-fine`).set(staff.auth);

    const paid = await request(app).patch(`/api/loans/${loan._id}/pay`).set(staff.auth);
    expect(paid.status).toBe(409);
  });
});
