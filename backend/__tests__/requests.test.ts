import request from "supertest";
import app from "../src/app";
import { Book } from "../src/models/book.model";
import { Loan } from "../src/models/loan.model";
import { BookRequest } from "../src/models/request.model";
import { loginAs } from "./helpers";

const BOOK = {
  isbn: "9780132350884",
  title: "Clean Code",
  author: "Robert Martin",
  category: "software",
  copiesTotal: 1,
};

const shelve = (overrides: Partial<typeof BOOK> = {}) => Book.create({ ...BOOK, ...overrides });

describe("POST /api/requests", () => {
  it("lets a member ask for a book and returns 201 with a Location header", async () => {
    const member = await loginAs("member");
    const book = await shelve();

    const response = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: book._id.toString() });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("pending");
    expect(response.body.data.book.title).toBe("Clean Code");
    expect(response.body.data.member.name).toBeDefined();
    expect(response.headers.location).toBe(`/api/requests/${response.body.data.id}`);
  });

  it("takes the member from the token, so a body cannot ask on someone else's behalf", async () => {
    const member = await loginAs("member");
    const victim = await loginAs("member");
    const book = await shelve();

    const response = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: book._id.toString(), memberId: victim.member._id.toString() });

    expect(response.status).toBe(201);
    expect(response.body.data.member.id).toBe(member.member._id.toString());
  });

  it("refuses a second open request for the same book with 409", async () => {
    const member = await loginAs("member");
    const book = await shelve();
    const body = { bookId: book._id.toString() };

    await request(app).post("/api/requests").set(member.auth).send(body);
    const second = await request(app).post("/api/requests").set(member.auth).send(body);

    expect(second.status).toBe(409);
  });

  it("allows asking again after a decision, because history must be repeatable", async () => {
    const member = await loginAs("member");
    const staff = await loginAs("librarian");
    const book = await shelve();
    const body = { bookId: book._id.toString() };

    const first = await request(app).post("/api/requests").set(member.auth).send(body);
    await request(app)
      .patch(`/api/requests/${first.body.data.id}/decline`)
      .set(staff.auth)
      .send({ note: "Reserved for a class" });

    const again = await request(app).post("/api/requests").set(member.auth).send(body);
    expect(again.status).toBe(201);
  });

  it("can be made even when every copy is out - that is the point of asking", async () => {
    const member = await loginAs("member");
    const holder = await loginAs("member");
    const book = await shelve({ copiesTotal: 1 });
    await Loan.create({ book: book._id, member: holder.member._id, dueDate: new Date() });

    const response = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: book._id.toString() });

    expect(response.status).toBe(201);
  });

  it("returns 400 for a malformed book id and 404 for an unknown one", async () => {
    const member = await loginAs("member");

    const malformed = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: "not-an-id" });
    expect(malformed.status).toBe(400);

    const unknown = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: "507f1f77bcf86cd799439011" });
    expect(unknown.status).toBe(404);
  });

  it("refuses an anonymous caller", async () => {
    const book = await shelve();
    const response = await request(app)
      .post("/api/requests")
      .send({ bookId: book._id.toString() });
    expect(response.status).toBe(401);
  });
});

describe("GET /api/requests", () => {
  it("shows staff the pending queue, oldest first", async () => {
    const member = await loginAs("member");
    const staff = await loginAs("librarian");
    const first = await shelve({ isbn: "9780132350884", title: "Asked First" });
    const second = await shelve({ isbn: "9780201616224", title: "Asked Second" });

    await request(app).post("/api/requests").set(member.auth).send({ bookId: first._id.toString() });
    await request(app).post("/api/requests").set(member.auth).send({ bookId: second._id.toString() });

    const response = await request(app).get("/api/requests?status=pending").set(staff.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.items.map((r: { book: { title: string } }) => r.book.title)).toEqual([
      "Asked First",
      "Asked Second",
    ]);
  });

  it("is staff-only: a member reading the whole queue gets 403", async () => {
    const member = await loginAs("member");
    const response = await request(app).get("/api/requests").set(member.auth);
    expect(response.status).toBe(403);
  });
});

describe("GET /api/requests/mine", () => {
  it("returns only the caller's own requests", async () => {
    const mine = await loginAs("member");
    const theirs = await loginAs("member");
    const book = await shelve();
    const other = await shelve({ isbn: "9780201616224", title: "Not Mine" });

    await request(app).post("/api/requests").set(mine.auth).send({ bookId: book._id.toString() });
    await request(app).post("/api/requests").set(theirs.auth).send({ bookId: other._id.toString() });

    const response = await request(app).get("/api/requests/mine").set(mine.auth);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].book.title).toBe("Clean Code");
  });

  it("is not read as a request id - the literal path wins", async () => {
    const member = await loginAs("member");
    const response = await request(app).get("/api/requests/mine").set(member.auth);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});

describe("PATCH /api/requests/:id/approve", () => {
  async function pendingRequest(copiesTotal = 1) {
    const member = await loginAs("member");
    const staff = await loginAs("librarian");
    const book = await shelve({ copiesTotal });
    const created = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: book._id.toString() });
    return { member, staff, book, id: created.body.data.id as string };
  }

  it("issues the loan and links it to the request", async () => {
    const { staff, book, member, id } = await pendingRequest();

    const response = await request(app).patch(`/api/requests/${id}/approve`).set(staff.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("approved");
    expect(response.body.data.loanId).toBeTruthy();

    const loan = await Loan.findById(response.body.data.loanId);
    expect(loan?.book?.toString()).toBe(book._id.toString());
    expect(loan?.member?.toString()).toBe(member.member._id.toString());
    expect(loan?.returnedAt).toBeNull();
  });

  it("refuses a second approval with 409 rather than issuing twice", async () => {
    const { staff, id } = await pendingRequest();
    await request(app).patch(`/api/requests/${id}/approve`).set(staff.auth);

    const again = await request(app).patch(`/api/requests/${id}/approve`).set(staff.auth);

    expect(again.status).toBe(409);
    expect(await Loan.countDocuments()).toBe(1);
  });

  it("applies the SAME refusal as issuing when no copy is free, and leaves it pending", async () => {
    const { staff, book, id } = await pendingRequest();
    const holder = await loginAs("member");
    await Loan.create({ book: book._id, member: holder.member._id, dueDate: new Date() });

    const response = await request(app).patch(`/api/requests/${id}/approve`).set(staff.auth);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("No copy of this book is available");
    const stored = await BookRequest.findById(id);
    expect(stored?.status).toBe("pending");
  });

  it("applies the SAME 422 as issuing when the member is at their borrow limit", async () => {
    const member = await loginAs("member", { membershipType: "standard" });
    const staff = await loginAs("librarian");

    for (let i = 0; i < 3; i += 1) {
      const filler = await shelve({ isbn: `978013468${5000 + i}`, title: `Filler ${i}` });
      await Loan.create({ book: filler._id, member: member.member._id, dueDate: new Date() });
    }
    const fourth = await shelve({ isbn: "9780201616224", title: "One Too Many" });
    const created = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: fourth._id.toString() });

    const response = await request(app)
      .patch(`/api/requests/${created.body.data.id}/approve`)
      .set(staff.auth);

    expect(response.status).toBe(422);
    expect(await BookRequest.findById(created.body.data.id)).toHaveProperty("status", "pending");
  });

  it("refuses a member approving their own request with 403", async () => {
    const { member, id } = await pendingRequest();
    const response = await request(app).patch(`/api/requests/${id}/approve`).set(member.auth);
    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/requests/:id/decline", () => {
  it("records the decision and the note", async () => {
    const member = await loginAs("member");
    const staff = await loginAs("librarian");
    const book = await shelve();
    const created = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: book._id.toString() });

    const response = await request(app)
      .patch(`/api/requests/${created.body.data.id}/decline`)
      .set(staff.auth)
      .send({ note: "Held for a reading list" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("declined");
    expect(response.body.data.decisionNote).toBe("Held for a reading list");
    expect(response.body.data.decidedAt).toBeTruthy();
    expect(await Loan.countDocuments()).toBe(0);
  });

  it("refuses a member declining with 403", async () => {
    const member = await loginAs("member");
    const book = await shelve();
    const created = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: book._id.toString() });

    const response = await request(app)
      .patch(`/api/requests/${created.body.data.id}/decline`)
      .set(member.auth)
      .send({ note: "please" });

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/requests/:id", () => {
  it("lets a member withdraw their own request", async () => {
    const member = await loginAs("member");
    const book = await shelve();
    const created = await request(app)
      .post("/api/requests")
      .set(member.auth)
      .send({ bookId: book._id.toString() });

    const response = await request(app)
      .delete(`/api/requests/${created.body.data.id}`)
      .set(member.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("cancelled");
  });

  it("reports someone else's request as MISSING, not forbidden", async () => {
    const owner = await loginAs("member");
    const stranger = await loginAs("member");
    const book = await shelve();
    const created = await request(app)
      .post("/api/requests")
      .set(owner.auth)
      .send({ bookId: book._id.toString() });

    const response = await request(app)
      .delete(`/api/requests/${created.body.data.id}`)
      .set(stranger.auth);

    expect(response.status).toBe(404);
    expect(await BookRequest.findById(created.body.data.id)).toHaveProperty("status", "pending");
  });
});

describe("deleting a book", () => {
  it("withdraws the open requests for it rather than orphaning them", async () => {
    const member = await loginAs("member");
    const staff = await loginAs("librarian");
    const book = await shelve();
    await request(app).post("/api/requests").set(member.auth).send({ bookId: book._id.toString() });

    const deleted = await request(app).delete(`/api/books/${book._id}`).set(staff.auth);
    expect(deleted.status).toBe(204);

    expect(await BookRequest.countDocuments({ book: book._id })).toBe(0);
  });
});
