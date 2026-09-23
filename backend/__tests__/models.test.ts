import mongoose from "mongoose";
import { User } from "../src/models/user.model";
import { Member } from "../src/models/member.model";
import { Book } from "../src/models/book.model";
import { Loan } from "../src/models/loan.model";
import { BORROW_LIMITS, LOAN_PERIOD_DAYS } from "../../shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("User", () => {
  it("hashes the password on save and never stores plaintext", async () => {
    const user = await User.create({ email: "A@Example.COM", passwordHash: "hunter2" });

    expect(user.passwordHash).not.toBe("hunter2");
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(user.email).toBe("a@example.com");
  });

  it("does not re-hash the hash on an unrelated save", async () => {
    const user = await User.create({ email: "b@example.com", passwordHash: "hunter2" });
    const firstHash = user.passwordHash;

    user.lastLoginAt = new Date();
    await user.save();

    expect(user.passwordHash).toBe(firstHash);
    await expect(user.verifyPassword("hunter2")).resolves.toBe(true);
  });

  it("keeps the hash out of queries and out of JSON", async () => {
    await User.create({ email: "c@example.com", passwordHash: "hunter2" });

    const found = await User.findOne({ email: "c@example.com" });
    expect(found?.passwordHash).toBeUndefined();

    const withHash = await User.findOne({ email: "c@example.com" }).select("+passwordHash");
    expect(withHash?.passwordHash).toBeDefined();
    expect(JSON.stringify(withHash)).not.toContain("$2b$");
  });

  it("rejects a malformed email and an unknown role", async () => {
    await expect(User.create({ email: "not-an-email", passwordHash: "x" })).rejects.toThrow();
    await expect(
      User.create({ email: "d@example.com", passwordHash: "x", role: "wizard" as never })
    ).rejects.toThrow();
  });
});

describe("Member linked to User", () => {
  it("links to a login account and derives the borrow limit", async () => {
    const user = await User.create({ email: "lib@example.com", passwordHash: "x", role: "librarian" });
    const member = await Member.create({
      name: "Ayesha",
      email: "lib@example.com",
      membershipType: "faculty",
      user: user._id,
    });

    expect(member.user?.toString()).toBe(user._id.toString());
    expect(member.borrowLimit).toBe(BORROW_LIMITS.faculty);
  });

  it("allows a member with no login account", async () => {
    const walkIn = await Member.create({ name: "Walk In", email: "walk@example.com" });
    expect(walkIn.user).toBeNull();
    expect(walkIn.borrowLimit).toBe(BORROW_LIMITS.standard);
  });
});

describe("Book with an embedded reservation queue", () => {
  it("embeds reservations in order", async () => {
    const first = new mongoose.Types.ObjectId();
    const second = new mongoose.Types.ObjectId();

    const book = await Book.create({
      isbn: "978-0-13-235088-4",
      title: "Clean Code",
      author: "Robert Martin",
      category: "software",
      copiesTotal: 2,
      reservations: [{ member: first }, { member: second }],
    });

    expect(book.reservations).toHaveLength(2);
    expect(book.reservations[0]?.member.toString()).toBe(first.toString());
  });

  it("rejects a bad ISBN", async () => {
    await expect(
      Book.create({ isbn: "nope", title: "T", author: "A", category: "c" })
    ).rejects.toThrow();
  });
});

describe("Loan referencing Book and Member", () => {
  it("defaults dueDate to the loan period and starts active", async () => {
    const loan = await Loan.create({
      book: new mongoose.Types.ObjectId(),
      member: new mongoose.Types.ObjectId(),
    });

    const days = Math.round((loan.dueDate.getTime() - loan.issuedAt.getTime()) / DAY_MS);
    expect(days).toBe(LOAN_PERIOD_DAYS);
    expect(loan.isActive).toBe(true);
    expect(loan.isOverdue).toBe(false);
    expect(loan.fineAmount).toBe(0);
  });

  it("derives overdue days from the due date, rounding part-days up", async () => {
    const loan = await Loan.create({
      book: new mongoose.Types.ObjectId(),
      member: new mongoose.Types.ObjectId(),
      issuedAt: new Date(Date.now() - 24 * DAY_MS),
      dueDate: new Date(Date.now() - 9.5 * DAY_MS),
    });

    expect(loan.isOverdue).toBe(true);
    expect(loan.daysOverdue).toBe(10);
  });

  it("counts a loan returned one second late as one day overdue", async () => {
    const dueDate = new Date(Date.now() - 60 * 60 * 1000);
    const loan = await Loan.create({
      book: new mongoose.Types.ObjectId(),
      member: new mongoose.Types.ObjectId(),
      dueDate,
      returnedAt: new Date(dueDate.getTime() + 1000),
    });

    expect(loan.daysOverdue).toBe(1);
  });

  it("is not overdue when returned on time", async () => {
    const dueDate = new Date(Date.now() + 3 * DAY_MS);
    const loan = await Loan.create({
      book: new mongoose.Types.ObjectId(),
      member: new mongoose.Types.ObjectId(),
      dueDate,
      returnedAt: new Date(),
    });

    expect(loan.isOverdue).toBe(false);
    expect(loan.daysOverdue).toBe(0);
  });

  it("populates the reference selectively, not the whole document", async () => {
    const member = await Member.create({ name: "Reader", email: "r@example.com" });
    const book = await Book.create({
      isbn: "9780132350884",
      title: "Clean Code",
      author: "Robert Martin",
      category: "software",
    });
    await Loan.create({ book: book._id, member: member._id });

    const loans = await Loan.find().populate("member", "name").populate("book", "title");
    const populatedMember = loans[0]?.member as unknown as { name: string; email?: string };

    expect(populatedMember.name).toBe("Reader");
    expect(populatedMember.email).toBeUndefined();
  });
});
