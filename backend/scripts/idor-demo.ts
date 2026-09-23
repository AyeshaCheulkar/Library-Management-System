import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { Server } from "node:http";
import app from "../src/app";
import { authenticate } from "../src/middleware/authenticate";
import { ownsMemberRecord } from "../src/middleware/ownership";
import { errorHandler } from "../src/middleware/errorHandler";
import { requestLogger } from "../src/middleware/requestLogger";
import { validateObjectId } from "../src/middleware/validate";
import * as loanCtrl from "../src/controllers/loan.controller";
import { User } from "../src/models/user.model";
import { Member } from "../src/models/member.model";
import { Book } from "../src/models/book.model";
import { Loan } from "../src/models/loan.model";
import { issueAccessToken } from "../src/services/auth.service";

const VULNERABLE_PORT = 4201;
const FIXED_PORT = 4202;

function buildVulnerableApp() {
  const vulnerable = express();
  vulnerable.use(requestLogger);
  vulnerable.get(
    "/api/members/:id/loans",
    authenticate,
    validateObjectId(),
    loanCtrl.listForMember
  );
  vulnerable.use(errorHandler);
  return vulnerable;
}

function listen(server: express.Express, port: number): Promise<Server> {
  return new Promise((resolve) => {
    const handle = server.listen(port, () => resolve(handle));
  });
}

async function curl(port: number, path: string, token: string) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  return { status: response.status, body };
}

function transcript(title: string, port: number, path: string, result: Awaited<ReturnType<typeof curl>>) {
  console.log(`
${title}
${"-".repeat(title.length)}

  $ curl -i -H "Authorization: Bearer $ALICE_TOKEN" \\
      http://localhost:${port}${path}

  HTTP/1.1 ${result.status}
  ${JSON.stringify(result.body, null, 2).split("\n").join("\n  ")}
`);
}

async function main(): Promise<void> {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Member.init(), Book.init(), Loan.init()]);

  const aliceUser = await User.create({ email: "alice@library.test", passwordHash: "hunter22222", role: "member" });
  const alice = await Member.create({ name: "Alice", email: "alice@library.test", user: aliceUser._id });

  const bobUser = await User.create({ email: "bob@library.test", passwordHash: "hunter22222", role: "member" });
  const bob = await Member.create({ name: "Bob", email: "bob@library.test", user: bobUser._id });

  const book = await Book.create({
    isbn: "9780132350884",
    title: "Treating Your Anxiety Disorder",
    author: "A. Clinician",
    category: "health",
    copiesTotal: 1,
  });
  await Loan.create({ book: book._id, member: bob._id });

  const aliceToken = issueAccessToken(aliceUser);
  const path = `/api/members/${bob._id.toString()}/loans`;

  const vulnerableServer = await listen(buildVulnerableApp(), VULNERABLE_PORT);
  const fixedServer = await listen(app, FIXED_PORT);

  const before = await curl(VULNERABLE_PORT, path, aliceToken);
  const after = await curl(FIXED_PORT, path, aliceToken);
  const own = await curl(FIXED_PORT, `/api/members/${alice._id.toString()}/loans`, aliceToken);

  console.log(`
============================================================
IDOR: GET /api/members/:id/loans
============================================================

Alice and Bob are both ordinary members. Alice is fully authenticated and has exactly the
role this endpoint requires. The only thing wrong with her request is whose id it names.

Bob's member id: ${bob._id.toString()}
Alice's member id: ${alice._id.toString()}`);

  transcript("BEFORE - route mounted without ownsMemberRecord", VULNERABLE_PORT, path, before);
  transcript("AFTER - the real route, one middleware added", FIXED_PORT, path, after);
  transcript("CONTROL - Alice reading her OWN record still works", FIXED_PORT, `/api/members/${alice._id.toString()}/loans`, own);

  console.log(`
What changed
------------

  router.get(
    "/:id/loans",
    authenticate,
    validateObjectId(),
+   ownsMemberRecord,          <-- this line
    loanCtrl.listForMember
  );

Note the AFTER response says nothing about whether Bob exists. Reading a member id that
does not exist returns the same 403 with the same message, so the endpoint cannot be used
to enumerate member ids either.

Status: ${before.status} -> ${after.status}. Alice's own record still returns ${own.status}.
`);

  vulnerableServer.close();
  fixedServer.close();
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
