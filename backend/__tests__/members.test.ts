import request from "supertest";
import app from "../src/app";
import { Member } from "../src/models/member.model";
import { Loan } from "../src/models/loan.model";
import { loginAs, PASSWORD } from "./helpers";

const WALK_IN = { name: "Walk In", email: "walkin@example.com" };

describe("POST /api/members", () => {
  it("lets a librarian register a walk-in borrower with no login account", async () => {
    const librarian = await loginAs("librarian");

    const response = await request(app).post("/api/members").set(librarian.auth).send(WALK_IN);

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe("Walk In");
    expect(response.body.data.userId).toBeNull();
    expect(response.body.data.membershipType).toBe("standard");
  });

  it("adopts the walk-in record when that person later registers an account", async () => {
    const librarian = await loginAs("librarian");
    await request(app).post("/api/members").set(librarian.auth).send(WALK_IN);

    const registered = await request(app)
      .post("/api/auth/register")
      .send({ email: WALK_IN.email, password: PASSWORD, name: WALK_IN.name });

    expect(registered.status).toBe(201);
    expect(await Member.countDocuments({ email: WALK_IN.email })).toBe(1);
    const member = await Member.findOne({ email: WALK_IN.email });
    expect(member?.user).not.toBeNull();
  });

  it("returns 409 for a duplicate email and 400 for a malformed one", async () => {
    const librarian = await loginAs("librarian");
    await request(app).post("/api/members").set(librarian.auth).send(WALK_IN);

    const duplicate = await request(app).post("/api/members").set(librarian.auth).send(WALK_IN);
    expect(duplicate.status).toBe(409);

    const malformed = await request(app)
      .post("/api/members")
      .set(librarian.auth)
      .send({ name: "X", email: "not-an-email" });
    expect(malformed.status).toBe(400);
  });

  it("returns 403 for a member and 401 with no token", async () => {
    const member = await loginAs("member");

    expect((await request(app).post("/api/members").set(member.auth).send(WALK_IN)).status).toBe(
      403
    );
    expect((await request(app).post("/api/members").send(WALK_IN)).status).toBe(401);
  });
});

describe("GET /api/members", () => {
  it("lists members for staff and refuses a plain member", async () => {
    const librarian = await loginAs("librarian");
    const member = await loginAs("member");

    const staffView = await request(app).get("/api/members").set(librarian.auth);
    expect(staffView.status).toBe(200);
    expect(staffView.body.data.items.length).toBeGreaterThan(0);

    expect((await request(app).get("/api/members").set(member.auth)).status).toBe(403);
  });
});

describe("GET /api/members/:id - the ownership boundary", () => {
  it("lets a member read their own record", async () => {
    const member = await loginAs("member");

    const response = await request(app)
      .get(`/api/members/${member.member.id}`)
      .set(member.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(member.member.id);
  });

  it("returns 403 when a member reads someone else's record", async () => {
    const alice = await loginAs("member");
    const bob = await loginAs("member");

    const response = await request(app).get(`/api/members/${bob.member.id}`).set(alice.auth);

    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain(bob.member.email);
  });

  it("does not distinguish 'not yours' from 'does not exist', so ids cannot be probed", async () => {
    const alice = await loginAs("member");
    const bob = await loginAs("member");

    const someoneElse = await request(app).get(`/api/members/${bob.member.id}`).set(alice.auth);
    const nobody = await request(app)
      .get("/api/members/507f1f77bcf86cd799439011")
      .set(alice.auth);

    expect(someoneElse.status).toBe(403);
    expect(nobody.status).toBe(403);
    expect(nobody.body.error.message).toBe(someoneElse.body.error.message);
  });

  it("lets a librarian read any member", async () => {
    const librarian = await loginAs("librarian");
    const member = await loginAs("member");

    const response = await request(app)
      .get(`/api/members/${member.member.id}`)
      .set(librarian.auth);

    expect(response.status).toBe(200);
  });
});

describe("PATCH /api/members/:id", () => {
  it("lets an admin change an entitlement", async () => {
    const admin = await loginAs("admin");
    const member = await loginAs("member");

    const response = await request(app)
      .patch(`/api/members/${member.member.id}`)
      .set(admin.auth)
      .send({ membershipType: "faculty", name: "Renamed" });

    expect(response.status).toBe(200);
    expect(response.body.data.membershipType).toBe("faculty");
    expect(response.body.data.name).toBe("Renamed");
  });

  it("refuses a librarian, because entitlement is not a desk decision", async () => {
    const librarian = await loginAs("librarian");
    const member = await loginAs("member");

    const response = await request(app)
      .patch(`/api/members/${member.member.id}`)
      .set(librarian.auth)
      .send({ membershipType: "faculty" });

    expect(response.status).toBe(403);
  });

  it("refuses a member raising their own borrow limit", async () => {
    const member = await loginAs("member");

    const response = await request(app)
      .patch(`/api/members/${member.member.id}`)
      .set(member.auth)
      .send({ membershipType: "faculty" });

    expect(response.status).toBe(403);
    const unchanged = await Member.findById(member.member.id);
    expect(unchanged?.membershipType).toBe("standard");
  });

  it("drops `user`, so nobody can point a member record at another login", async () => {
    const admin = await loginAs("admin");
    const alice = await loginAs("member");
    const bob = await loginAs("member");

    const response = await request(app)
      .patch(`/api/members/${alice.member.id}`)
      .set(admin.auth)
      .send({ name: "Renamed", user: bob.user._id.toString() });

    expect(response.status).toBe(200);
    expect(response.body.data.userId).toBe(alice.user._id.toString());
  });
});

describe("DELETE /api/members/:id", () => {
  it("deletes a member with no active loans", async () => {
    const admin = await loginAs("admin");
    const librarian = await loginAs("librarian");
    const created = await request(app).post("/api/members").set(librarian.auth).send(WALK_IN);

    const response = await request(app)
      .delete(`/api/members/${created.body.data.id}`)
      .set(admin.auth);

    expect(response.status).toBe(204);
  });

  it("returns 409 while that member still holds a book", async () => {
    const admin = await loginAs("admin");
    const borrower = await loginAs("member");
    await Loan.create({ book: borrower.user._id, member: borrower.member._id });

    const response = await request(app)
      .delete(`/api/members/${borrower.member.id}`)
      .set(admin.auth);

    expect(response.status).toBe(409);
    expect(await Loan.countDocuments()).toBe(1);
  });

  it("returns 404 for an id that does not exist and 403 for a librarian", async () => {
    const admin = await loginAs("admin");
    const librarian = await loginAs("librarian");
    const member = await loginAs("member");

    expect(
      (await request(app).delete("/api/members/507f1f77bcf86cd799439011").set(admin.auth)).status
    ).toBe(404);

    expect(
      (await request(app).delete(`/api/members/${member.member.id}`).set(librarian.auth)).status
    ).toBe(403);
  });
});
