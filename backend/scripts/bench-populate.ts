import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Book } from "../src/models/book.model";
import { Member } from "../src/models/member.model";
import { Loan } from "../src/models/loan.model";

const LOAN_COUNT = 25;

function bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

async function main(): Promise<void> {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Book.init(), Member.init(), Loan.init()]);

  const member = await Member.create({
    name: "Meera Member",
    email: "meera@library.test",
    membershipType: "premium",
  });

  for (let i = 0; i < LOAN_COUNT; i += 1) {
    const book = await Book.create({
      isbn: `978013235${String(i).padStart(4, "0")}`,
      title: `A Reasonably Typical Book Title Number ${i}`,
      author: "Robert C. Martin",
      category: "software",
      copiesTotal: 2,
    });
    await Loan.create({ book: book._id, member: member._id });
  }

  const unconstrained = await Loan.find().populate("book").populate("member");

  const constrained = await Loan.find()
    .populate("book", "title author isbn")
    .populate("member", "name");

  const before = bytes(unconstrained);
  const after = bytes(constrained);
  const saved = before - after;
  const percent = ((saved / before) * 100).toFixed(1);

  console.log(`
Populate payload benchmark - ${LOAN_COUNT} loans, one borrower
Reproduce with: cd backend && npm run bench:populate

  variant                            bytes    per row
  ---------------------------------------------------------
  unconstrained populate           ${String(before).padStart(7)}  ${String(Math.round(before / LOAN_COUNT)).padStart(7)}
  constrained populate             ${String(after).padStart(7)}  ${String(Math.round(after / LOAN_COUNT)).padStart(7)}
  ---------------------------------------------------------
  saved                            ${String(saved).padStart(7)}      ${percent}%

The saving scales with the number of ROWS, not the number of borrowers: every extra loan
re-sends the same borrower document again.
`);

  await mongoose.disconnect();
  await mongo.stop();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
