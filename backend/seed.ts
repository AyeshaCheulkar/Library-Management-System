import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase, disconnectFromDatabase } from "./src/db";
import { User } from "./src/models/user.model";
import { Member } from "./src/models/member.model";
import { Book } from "./src/models/book.model";
import { Loan } from "./src/models/loan.model";
import { BookRequest } from "./src/models/request.model";
import { LOAN_PERIOD_DAYS } from "../shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD = "library-demo-2026";

const CATALOGUE = [
  { isbn: "9780132350884", title: "Clean Code", author: "Robert C. Martin", category: "software", copiesTotal: 3 },
  { isbn: "9780201616224", title: "The Pragmatic Programmer", author: "Andrew Hunt", category: "software", copiesTotal: 2 },
  { isbn: "9780134685991", title: "Effective Java", author: "Joshua Bloch", category: "software", copiesTotal: 1 },
  { isbn: "9780596007126", title: "Head First Design Patterns", author: "Eric Freeman", category: "software", copiesTotal: 1 },
  { isbn: "9780134757599", title: "Refactoring", author: "Martin Fowler", category: "software", copiesTotal: 2 },
  { isbn: "9780201835953", title: "The Mythical Man-Month", author: "Frederick P. Brooks Jr.", category: "software", copiesTotal: 2 },
  { isbn: "9780735619678", title: "Code Complete", author: "Steve McConnell", category: "software", copiesTotal: 3 },
  { isbn: "9780131177055", title: "Working Effectively with Legacy Code", author: "Michael C. Feathers", category: "software", copiesTotal: 1 },
  { isbn: "9780201633610", title: "Design Patterns", author: "Erich Gamma", category: "software", copiesTotal: 2 },
  { isbn: "9780321146533", title: "Test-Driven Development: By Example", author: "Kent Beck", category: "software", copiesTotal: 2 },

  { isbn: "9780262033848", title: "Introduction to Algorithms", author: "Thomas H. Cormen", category: "theory", copiesTotal: 2 },
  { isbn: "9780262510875", title: "Structure and Interpretation of Computer Programs", author: "Harold Abelson", category: "theory", copiesTotal: 2 },
  { isbn: "9780201896831", title: "The Art of Computer Programming, Volume 1", author: "Donald E. Knuth", category: "theory", copiesTotal: 1 },
  { isbn: "9780321573513", title: "Algorithms", author: "Robert Sedgewick", category: "theory", copiesTotal: 3 },
  { isbn: "9781133187790", title: "Introduction to the Theory of Computation", author: "Michael Sipser", category: "theory", copiesTotal: 2 },
  { isbn: "9780201558029", title: "Concrete Mathematics", author: "Ronald L. Graham", category: "theory", copiesTotal: 1 },
  { isbn: "9781848000698", title: "The Algorithm Design Manual", author: "Steven S. Skiena", category: "theory", copiesTotal: 2 },
  { isbn: "9780201530827", title: "Computational Complexity", author: "Christos H. Papadimitriou", category: "theory", copiesTotal: 1 },
  { isbn: "9780262162098", title: "Types and Programming Languages", author: "Benjamin C. Pierce", category: "theory", copiesTotal: 1 },
  { isbn: "9780073383095", title: "Discrete Mathematics and Its Applications", author: "Kenneth H. Rosen", category: "theory", copiesTotal: 3 },

  { isbn: "9781449373320", title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", category: "systems", copiesTotal: 2 },
  { isbn: "9781985086593", title: "Operating Systems: Three Easy Pieces", author: "Remzi H. Arpaci-Dusseau", category: "systems", copiesTotal: 2 },
  { isbn: "9780134092669", title: "Computer Systems: A Programmer's Perspective", author: "Randal E. Bryant", category: "systems", copiesTotal: 3 },
  { isbn: "9780133591620", title: "Modern Operating Systems", author: "Andrew S. Tanenbaum", category: "systems", copiesTotal: 2 },
  { isbn: "9780132126953", title: "Computer Networks", author: "Andrew S. Tanenbaum", category: "systems", copiesTotal: 2 },
  { isbn: "9781593272203", title: "The Linux Programming Interface", author: "Michael Kerrisk", category: "systems", copiesTotal: 1 },
  { isbn: "9780078022159", title: "Database System Concepts", author: "Abraham Silberschatz", category: "systems", copiesTotal: 3 },
  { isbn: "9781543057386", title: "Distributed Systems", author: "Maarten van Steen", category: "systems", copiesTotal: 1 },
  { isbn: "9781491929124", title: "Site Reliability Engineering", author: "Betsy Beyer", category: "systems", copiesTotal: 2 },
  { isbn: "9780128119051", title: "Computer Architecture: A Quantitative Approach", author: "John L. Hennessy", category: "systems", copiesTotal: 1 },

  { isbn: "9781593279509", title: "Eloquent JavaScript", author: "Marijn Haverbeke", category: "web", copiesTotal: 2 },
  { isbn: "9781491954621", title: "Programming TypeScript", author: "Boris Cherny", category: "web", copiesTotal: 1 },
  { isbn: "9781617294136", title: "Node.js in Action", author: "Alex Young", category: "web", copiesTotal: 2 },
  { isbn: "9780596517748", title: "JavaScript: The Good Parts", author: "Douglas Crockford", category: "web", copiesTotal: 2 },
  { isbn: "9781091210099", title: "You Don't Know JS Yet", author: "Kyle Simpson", category: "web", copiesTotal: 2 },
  { isbn: "9781118008188", title: "HTML and CSS: Design and Build Websites", author: "Jon Duckett", category: "web", copiesTotal: 3 },
  { isbn: "9781492051725", title: "Learning React", author: "Alex Banks", category: "web", copiesTotal: 2 },
  { isbn: "9781449393199", title: "CSS: The Definitive Guide", author: "Eric A. Meyer", category: "web", copiesTotal: 1 },
  { isbn: "9781449344764", title: "High Performance Browser Networking", author: "Ilya Grigorik", category: "web", copiesTotal: 1 },
  { isbn: "9780071843652", title: "Web Scalability for Startup Engineers", author: "Artur Ejsmont", category: "web", copiesTotal: 1 },

  { isbn: "9780134494166", title: "Clean Architecture", author: "Robert C. Martin", category: "architecture", copiesTotal: 1 },
  { isbn: "9780321125217", title: "Domain-Driven Design", author: "Eric Evans", category: "architecture", copiesTotal: 2 },
  { isbn: "9780321127426", title: "Patterns of Enterprise Application Architecture", author: "Martin Fowler", category: "architecture", copiesTotal: 2 },
  { isbn: "9781492034025", title: "Building Microservices", author: "Sam Newman", category: "architecture", copiesTotal: 2 },
  { isbn: "9780136886099", title: "Software Architecture in Practice", author: "Len Bass", category: "architecture", copiesTotal: 1 },
  { isbn: "9780321200686", title: "Enterprise Integration Patterns", author: "Gregor Hohpe", category: "architecture", copiesTotal: 1 },
  { isbn: "9781680502398", title: "Release It!", author: "Michael T. Nygard", category: "architecture", copiesTotal: 2 },
  { isbn: "9781492043454", title: "Fundamentals of Software Architecture", author: "Mark Richards", category: "architecture", copiesTotal: 3 },
  { isbn: "9781492047841", title: "Monolith to Microservices", author: "Sam Newman", category: "architecture", copiesTotal: 1 },
  { isbn: "9781492077541", title: "The Software Architect Elevator", author: "Gregor Hohpe", category: "architecture", copiesTotal: 1 },
];

async function createAccount(
  email: string,
  role: "member" | "librarian" | "admin",
  name: string,
  membershipType: "standard" | "premium" | "faculty",
  withMember = true
) {
  const user = await User.create({ email, passwordHash: PASSWORD, role });
  const member = withMember
    ? await Member.create({ name, email, membershipType, user: user._id })
    : null;
  return { user, member };
}

export async function seed(): Promise<void> {
  await connectToDatabase();

  console.log("Clearing existing data...");
  await Promise.all([
    User.deleteMany({}),
    Member.deleteMany({}),
    Book.deleteMany({}),
    Loan.deleteMany({}),
  ]);

  await Promise.all([User.init(), Member.init(), Book.init(), Loan.init()]);

  console.log("Creating accounts...");
  const admin = await createAccount("admin@library.test", "admin", "Asha Admin", "standard", false);
  const librarian = await createAccount("librarian@library.test", "librarian", "Leela Librarian", "faculty");
  const member = await createAccount("member@library.test", "member", "Meera Member", "standard");
  const premium = await createAccount("premium@library.test", "member", "Prakash Premium", "premium");

  const walkIn = await Member.create({
    name: "Wasim Walk-in",
    email: "walkin@library.test",
    membershipType: "standard",
  });

  console.log("Creating catalogue...");
  const books = await Book.insertMany(CATALOGUE);
  const byIsbn = (isbn: string) => books.find((book) => book.isbn === isbn)!;

  console.log("Creating loans...");
  const now = Date.now();

  await Loan.create({
    book: byIsbn("9780132350884")._id,
    member: member.member!._id,
    issuedAt: new Date(now - 3 * DAY_MS),
    dueDate: new Date(now + (LOAN_PERIOD_DAYS - 3) * DAY_MS),
  });

  await Loan.create({
    book: byIsbn("9780262033848")._id,
    member: member.member!._id,
    issuedAt: new Date(now - 22 * DAY_MS),
    dueDate: new Date(now - 7.5 * DAY_MS),
  });

  await Loan.create({
    book: byIsbn("9780201616224")._id,
    member: premium.member!._id,
    issuedAt: new Date(now - 30 * DAY_MS),
    dueDate: new Date(now - 16 * DAY_MS),
    returnedAt: new Date(now - 11 * DAY_MS),
    fineAmount: 25,
  });

  await Loan.create({
    book: byIsbn("9780596007126")._id,
    member: premium.member!._id,
    issuedAt: new Date(now - 40 * DAY_MS),
    dueDate: new Date(now - 26 * DAY_MS),
    returnedAt: new Date(now - 20 * DAY_MS),
    fineAmount: 0,
    waivedAt: new Date(now - 20 * DAY_MS),
    waivedBy: librarian.user._id,
  });

  await Loan.create({
    book: byIsbn("9781617294136")._id,
    member: walkIn._id,
    issuedAt: new Date(now - 5 * DAY_MS),
    dueDate: new Date(now + (LOAN_PERIOD_DAYS - 5) * DAY_MS),
  });

  const scarce = byIsbn("9780134685991");
  await Loan.create({
    book: scarce._id,
    member: premium.member!._id,
    issuedAt: new Date(now - 2 * DAY_MS),
    dueDate: new Date(now + (LOAN_PERIOD_DAYS - 2) * DAY_MS),
  });
  scarce.reservations.push({ member: member.member!._id, reservedAt: new Date(now - DAY_MS) });
  await scarce.save();

  console.log("Creating requests...");

  await BookRequest.create({
    book: byIsbn("9780134757599")._id,
    member: member.member!._id,
    requestedAt: new Date(now - 2 * DAY_MS),
  });

  await BookRequest.create({
    book: scarce._id,
    member: premium.member!._id,
    requestedAt: new Date(now - DAY_MS),
  });

  await BookRequest.create({
    book: byIsbn("9780201896831")._id,
    member: member.member!._id,
    status: "declined",
    requestedAt: new Date(now - 9 * DAY_MS),
    decidedBy: librarian.user._id,
    decidedAt: new Date(now - 8 * DAY_MS),
    decisionNote: "Reference copy - library use only",
  });

  const [users, members, bookCount, loans, requests] = await Promise.all([
    User.countDocuments(),
    Member.countDocuments(),
    Book.countDocuments(),
    Loan.countDocuments(),
    BookRequest.countDocuments(),
  ]);

  console.log(`
Seeded: ${users} users, ${members} members, ${bookCount} books, ${loans} loans, ${requests} requests.

  Sign in with any of these - the password is the same for all three:

    admin@library.test       admin       ${PASSWORD}
    librarian@library.test   librarian   ${PASSWORD}
    member@library.test      member      ${PASSWORD}

  Also seeded:
    premium@library.test     member (premium tier, one settled and one waived fine)
    Wasim Walk-in            a borrower with NO login account, currently holding a book

  Worth looking at:
    - Meera has an overdue loan; her member page flags the row and shows the accrued fine
    - "Effective Java" has its only copy out and Meera queued behind it
    - deleting Wasim returns 409 while he still holds a book
    - the librarian's Requests tab has two pending asks: "Refactoring" approves cleanly,
      "Effective Java" is refused with a 409 because its only copy is out
    - the admin's Accounts tab can promote Meera to librarian; it takes effect on her
      very next click, without her signing in again
`);

  await disconnectFromDatabase();
}

if (require.main === module) {
  seed().catch(async (error) => {
    console.error("Seed failed:", error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
}
