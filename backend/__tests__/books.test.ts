import request from "supertest";
import app from "../src/app";
import { Book } from "../src/models/book.model";
import { Loan } from "../src/models/loan.model";
import { loginAs } from "./helpers";

const VALID_BOOK = {
  isbn: "978-0-13-235088-4",
  title: "Clean Code",
  author: "Robert Martin",
  category: "software",
  copiesTotal: 3,
};

describe("POST /api/books", () => {
  it("creates a book and returns 201 with a Location header", async () => {
    const librarian = await loginAs("librarian");

    const response = await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe("Clean Code");
    expect(response.headers.location).toBe(`/api/books/${response.body.data.id}`);
  });

  it("returns 409 for a duplicate ISBN", async () => {
    const librarian = await loginAs("librarian");
    await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    const response = await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("returns 400 for a malformed ISBN", async () => {
    const librarian = await loginAs("librarian");

    const response = await request(app)
      .post("/api/books")
      .set(librarian.auth)
      .send({ ...VALID_BOOK, isbn: "nope" });

    expect(response.status).toBe(400);
  });

  it("returns 403 for a member, and 401 with no token", async () => {
    const member = await loginAs("member");

    expect((await request(app).post("/api/books").set(member.auth).send(VALID_BOOK)).status).toBe(
      403
    );
    expect((await request(app).post("/api/books").send(VALID_BOOK)).status).toBe(401);
  });
});

describe("GET /api/books", () => {
  it("lists books with pagination metadata", async () => {
    const librarian = await loginAs("librarian");
    await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    const response = await request(app).get("/api/books").set(librarian.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.page).toBe(1);
  });

  it("filters by category and searches the text index", async () => {
    const librarian = await loginAs("librarian");
    await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);
    await request(app)
      .post("/api/books")
      .set(librarian.auth)
      .send({
        isbn: "9780262033848",
        title: "Introduction to Algorithms",
        author: "Cormen",
        category: "theory",
      });

    const byCategory = await request(app).get("/api/books?category=theory").set(librarian.auth);
    expect(byCategory.body.data.items).toHaveLength(1);
    expect(byCategory.body.data.items[0].title).toBe("Introduction to Algorithms");

    const bySearch = await request(app).get("/api/books?search=Cormen").set(librarian.auth);
    expect(bySearch.body.data.items).toHaveLength(1);
  });

  it("clamps an absurd page size rather than trusting it", async () => {
    const member = await loginAs("member");

    const response = await request(app).get("/api/books?pageSize=999999").set(member.auth);

    expect(response.body.data.pageSize).toBe(100);
  });

  it("lets a plain member browse, but not an anonymous caller", async () => {
    const member = await loginAs("member");

    expect((await request(app).get("/api/books").set(member.auth)).status).toBe(200);
    expect((await request(app).get("/api/books")).status).toBe(401);
  });
});

describe("GET /api/books?available=true", () => {
  async function shelve(overrides: Partial<typeof VALID_BOOK> & { isbn: string }) {
    return Book.create({ ...VALID_BOOK, ...overrides });
  }

  it("excludes a book whose every copy is out, and includes a partly-lent one", async () => {
    const staff = await loginAs("librarian");
    const soleCopy = await shelve({ isbn: "9780134685991", title: "All Out", copiesTotal: 1 });
    const spare = await shelve({ isbn: "9781449373320", title: "One Spare", copiesTotal: 2 });
    await Loan.create({ book: soleCopy._id, member: staff.member._id, dueDate: new Date() });
    await Loan.create({ book: spare._id, member: staff.member._id, dueDate: new Date() });

    const response = await request(app)
      .get("/api/books?available=true")
      .set(staff.auth);

    expect(response.status).toBe(200);
    const titles = response.body.data.items.map((b: { title: string }) => b.title);
    expect(titles).toContain("One Spare");
    expect(titles).not.toContain("All Out");
  });

  it("counts a returned loan as no longer active", async () => {
    const staff = await loginAs("librarian");
    const book = await shelve({ isbn: "9780134685991", title: "Came Back", copiesTotal: 1 });
    const loan = await Loan.create({
      book: book._id,
      member: staff.member._id,
      dueDate: new Date(),
    });

    const whileOut = await request(app).get("/api/books?available=true").set(staff.auth);
    expect(whileOut.body.data.total).toBe(0);

    loan.returnedAt = new Date();
    await loan.save();

    const afterReturn = await request(app).get("/api/books?available=true").set(staff.auth);
    expect(afterReturn.body.data.total).toBe(1);
  });

  it("filters BEFORE paging, so the total counts available books not fetched ones", async () => {
    const staff = await loginAs("librarian");
    for (let i = 0; i < 8; i += 1) {
      const book = await shelve({
        isbn: `978013468${String(1000 + i)}`,
        title: `Book ${String.fromCharCode(65 + i)}`,
        copiesTotal: 1,
      });
      if (i < 3) {
        await Loan.create({ book: book._id, member: staff.member._id, dueDate: new Date() });
      }
    }

    const response = await request(app)
      .get("/api/books?available=true&page=1&pageSize=3")
      .set(staff.auth);

    expect(response.body.data.total).toBe(5);
    expect(response.body.data.items).toHaveLength(3);

    const page2 = await request(app)
      .get("/api/books?available=true&page=2&pageSize=3")
      .set(staff.auth);
    expect(page2.body.data.items).toHaveLength(2);
    expect(page2.body.data.total).toBe(5);
  });

  it("combines with the category filter rather than replacing it", async () => {
    const staff = await loginAs("librarian");
    await shelve({ isbn: "9780134685991", title: "Free Theory", category: "theory" });
    const lent = await shelve({
      isbn: "9781449373320",
      title: "Lent Theory",
      category: "theory",
      copiesTotal: 1,
    });
    await shelve({ isbn: "9781593279509", title: "Free Web", category: "web" });
    await Loan.create({ book: lent._id, member: staff.member._id, dueDate: new Date() });

    const response = await request(app)
      .get("/api/books?available=true&category=theory")
      .set(staff.auth);

    expect(response.body.data.items.map((b: { title: string }) => b.title)).toEqual([
      "Free Theory",
    ]);
  });

  it("keeps the derived cover, which a plain aggregation would have dropped", async () => {
    const staff = await loginAs("librarian");
    await shelve({ isbn: "9780132350884" });

    const response = await request(app).get("/api/books?available=true").set(staff.auth);

    expect(response.body.data.items[0].coverUrl).toBe(
      "https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg?default=false"
    );
    expect(response.body.data.items[0].reservations).toEqual([]);
  });

  it("is off unless explicitly asked for", async () => {
    const staff = await loginAs("librarian");
    const book = await shelve({ isbn: "9780134685991", copiesTotal: 1 });
    await Loan.create({ book: book._id, member: staff.member._id, dueDate: new Date() });

    for (const qs of ["", "?available=false", "?available=yes", "?available="]) {
      const response = await request(app).get(`/api/books${qs}`).set(staff.auth);
      expect(response.body.data.total).toBe(1);
    }
  });
});

describe("GET /api/books/categories", () => {
  it("reports every category with its counts, from a pipeline not a page", async () => {
    const staff = await loginAs("librarian");
    await Book.create([
      { ...VALID_BOOK, isbn: "9780132350884", category: "software", copiesTotal: 3 },
      { ...VALID_BOOK, isbn: "9780201616224", category: "software", copiesTotal: 2 },
      { ...VALID_BOOK, isbn: "9780262033848", category: "theory", copiesTotal: 4 },
    ]);

    const response = await request(app)
      .get("/api/books/categories")
      .set(staff.auth);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      { category: "software", bookCount: 2, copiesTotal: 5 },
      { category: "theory", bookCount: 1, copiesTotal: 4 },
    ]);
  });

  it("reports a category whose books are all past the first page", async () => {
    const staff = await loginAs("librarian");
    await Book.create(
      Array.from({ length: 25 }, (_, i) => ({
        ...VALID_BOOK,
        isbn: `97801343${String(10000 + i).padStart(5, "0")}`,
        title: `Aaa ${i}`,
        category: "software",
      }))
    );
    await Book.create({ ...VALID_BOOK, isbn: "9780262033848", title: "Zzz", category: "theory" });

    const firstPage = await request(app)
      .get("/api/books?page=1&pageSize=20")
      .set(staff.auth);
    expect(firstPage.body.data.items.some((b: { category: string }) => b.category === "theory"))
      .toBe(false);

    const categories = await request(app)
      .get("/api/books/categories")
      .set(staff.auth);
    expect(categories.body.data.map((row: { category: string }) => row.category))
      .toEqual(["software", "theory"]);
  });

  it("is not read as a book id - the route order is load-bearing", async () => {
    const staff = await loginAs("librarian");
    const response = await request(app)
      .get("/api/books/categories")
      .set(staff.auth);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("refuses an anonymous caller", async () => {
    const response = await request(app).get("/api/books/categories");
    expect(response.status).toBe(401);
  });
});

describe("cover URLs", () => {
  it("derives a cover from the ISBN rather than storing one", async () => {
    const staff = await loginAs("librarian");
    const created = await request(app)
      .post("/api/books")
      .set(staff.auth)
      .send(VALID_BOOK);

    expect(created.body.data.coverUrl).toBe(
      "https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg?default=false"
    );
    const stored = await Book.findById(created.body.data.id).lean();
    expect(stored?.coverUrl).toBeUndefined();
  });

  it("prefers a librarian's override when one is supplied", async () => {
    const staff = await loginAs("librarian");
    const created = await request(app)
      .post("/api/books")
      .set(staff.auth)
      .send({ ...VALID_BOOK, coverUrl: "https://example.test/cover.jpg" });

    expect(created.body.data.coverUrl).toBe("https://example.test/cover.jpg");
  });

  it("refuses a non-https cover, because the value lands in an img src", async () => {
    const staff = await loginAs("librarian");
    const response = await request(app)
      .post("/api/books")
      .set(staff.auth)
      .send({ ...VALID_BOOK, coverUrl: "javascript:alert(1)" });

    expect(response.status).toBe(400);
  });
});

describe("GET /api/books/:id", () => {
  it("reads one book", async () => {
    const librarian = await loginAs("librarian");
    const created = await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    const response = await request(app)
      .get(`/api/books/${created.body.data.id}`)
      .set(librarian.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.isbn).toBe(VALID_BOOK.isbn);
  });

  it("returns 404 for an id that does not exist", async () => {
    const librarian = await loginAs("librarian");

    const response = await request(app)
      .get("/api/books/507f1f77bcf86cd799439011")
      .set(librarian.auth);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 - not 404 or 500 - for a malformed id", async () => {
    const librarian = await loginAs("librarian");

    const response = await request(app).get("/api/books/not-an-id").set(librarian.auth);

    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/books/:id", () => {
  it("updates the allowed fields", async () => {
    const librarian = await loginAs("librarian");
    const created = await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    const response = await request(app)
      .patch(`/api/books/${created.body.data.id}`)
      .set(librarian.auth)
      .send({ copiesTotal: 7, category: "engineering" });

    expect(response.status).toBe(200);
    expect(response.body.data.copiesTotal).toBe(7);
    expect(response.body.data.category).toBe("engineering");
  });

  it("ignores fields outside the whitelist rather than applying them", async () => {
    const librarian = await loginAs("librarian");
    const created = await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    const response = await request(app)
      .patch(`/api/books/${created.body.data.id}`)
      .set(librarian.auth)
      .send({ title: "Renamed", isbn: "9780262033848", reservations: [{ member: "x" }] });

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Renamed");
    expect(response.body.data.isbn).toBe(VALID_BOOK.isbn);
    expect(response.body.data.reservations).toHaveLength(0);
  });

  it("returns 403 for a member", async () => {
    const librarian = await loginAs("librarian");
    const member = await loginAs("member");
    const created = await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    const response = await request(app)
      .patch(`/api/books/${created.body.data.id}`)
      .set(member.auth)
      .send({ title: "Hacked" });

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/books/:id", () => {
  it("deletes a book with no active loans and returns 204", async () => {
    const librarian = await loginAs("librarian");
    const created = await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    const response = await request(app)
      .delete(`/api/books/${created.body.data.id}`)
      .set(librarian.auth);

    expect(response.status).toBe(204);
    expect(await Book.countDocuments()).toBe(0);
  });

  it("returns 409 while a copy is still out, and leaves the loan intact", async () => {
    const librarian = await loginAs("librarian");
    const borrower = await loginAs("member");
    const created = await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    await Loan.create({ book: created.body.data.id, member: borrower.member._id });

    const response = await request(app)
      .delete(`/api/books/${created.body.data.id}`)
      .set(librarian.auth);

    expect(response.status).toBe(409);
    expect(await Book.countDocuments()).toBe(1);
    expect(await Loan.countDocuments()).toBe(1);
  });

  it("allows the delete once the copy has come back", async () => {
    const librarian = await loginAs("librarian");
    const borrower = await loginAs("member");
    const created = await request(app).post("/api/books").set(librarian.auth).send(VALID_BOOK);

    await Loan.create({
      book: created.body.data.id,
      member: borrower.member._id,
      returnedAt: new Date(),
    });

    const response = await request(app)
      .delete(`/api/books/${created.body.data.id}`)
      .set(librarian.auth);

    expect(response.status).toBe(204);
  });
});
