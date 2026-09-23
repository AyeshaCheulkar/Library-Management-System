import request from "supertest";
import app from "../src/app";
import { User } from "../src/models/user.model";
import { loginAs } from "./helpers";

describe("GET /api/users", () => {
  it("lists accounts for an admin, with the linked borrower record", async () => {
    const admin = await loginAs("admin");
    const member = await loginAs("member");

    const response = await request(app).get("/api/users").set(admin.auth);

    expect(response.status).toBe(200);
    const row = response.body.data.items.find(
      (account: { id: string }) => account.id === member.user._id.toString()
    );
    expect(row.role).toBe("member");
    expect(row.isActive).toBe(true);
    expect(row.memberId).toBe(member.member._id.toString());
    expect(row.memberName).toBeTruthy();
  });

  it("never returns a password hash", async () => {
    const admin = await loginAs("admin");
    await loginAs("member");

    const response = await request(app).get("/api/users").set(admin.auth);

    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain("$2b$");
  });

  it("refuses a LIBRARIAN with 403 - this is the admin/librarian boundary", async () => {
    const librarian = await loginAs("librarian");
    const response = await request(app).get("/api/users").set(librarian.auth);
    expect(response.status).toBe(403);
  });

  it("refuses a member with 403 and an anonymous caller with 401", async () => {
    const member = await loginAs("member");
    expect((await request(app).get("/api/users").set(member.auth)).status).toBe(403);
    expect((await request(app).get("/api/users")).status).toBe(401);
  });
});

describe("PATCH /api/users/:id/role", () => {
  it("promotes a member to librarian, effective on their very next request", async () => {
    const admin = await loginAs("admin");
    const member = await loginAs("member");

    const before = await request(app).get("/api/members").set(member.auth);
    expect(before.status).toBe(403);

    const promoted = await request(app)
      .patch(`/api/users/${member.user._id}/role`)
      .set(admin.auth)
      .send({ role: "librarian" });
    expect(promoted.status).toBe(200);
    expect(promoted.body.data.role).toBe("librarian");

    const after = await request(app).get("/api/members").set(member.auth);
    expect(after.status).toBe(200);
  });

  it("demotes a librarian back to member", async () => {
    const admin = await loginAs("admin");
    const librarian = await loginAs("librarian");

    await request(app)
      .patch(`/api/users/${librarian.user._id}/role`)
      .set(admin.auth)
      .send({ role: "member" });

    expect((await request(app).get("/api/members").set(librarian.auth)).status).toBe(403);
  });

  it("refuses an admin changing their OWN role, so nobody can lock everyone out", async () => {
    const admin = await loginAs("admin");

    const response = await request(app)
      .patch(`/api/users/${admin.user._id}/role`)
      .set(admin.auth)
      .send({ role: "member" });

    expect(response.status).toBe(422);
    const stored = await User.findById(admin.user._id);
    expect(stored?.role).toBe("admin");
  });

  it("returns 400 for a role that is not a role", async () => {
    const admin = await loginAs("admin");
    const member = await loginAs("member");

    const response = await request(app)
      .patch(`/api/users/${member.user._id}/role`)
      .set(admin.auth)
      .send({ role: "superuser" });

    expect(response.status).toBe(400);
  });

  it("refuses a librarian promoting anyone, including themselves", async () => {
    const librarian = await loginAs("librarian");

    const response = await request(app)
      .patch(`/api/users/${librarian.user._id}/role`)
      .set(librarian.auth)
      .send({ role: "admin" });

    expect(response.status).toBe(403);
  });

  it("returns 404 for an account that does not exist", async () => {
    const admin = await loginAs("admin");
    const response = await request(app)
      .patch("/api/users/507f1f77bcf86cd799439011/role")
      .set(admin.auth)
      .send({ role: "librarian" });
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/users/:id/active", () => {
  it("deactivates an account and kills the session it already had", async () => {
    const admin = await loginAs("admin");
    const member = await loginAs("member");

    expect((await request(app).get("/api/auth/me").set(member.auth)).status).toBe(200);

    const response = await request(app)
      .patch(`/api/users/${member.user._id}/active`)
      .set(admin.auth)
      .send({ isActive: false });
    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(false);

    const after = await request(app).get("/api/auth/me").set(member.auth);
    expect(after.status).toBe(403);
  });

  it("refuses an admin deactivating themselves", async () => {
    const admin = await loginAs("admin");

    const response = await request(app)
      .patch(`/api/users/${admin.user._id}/active`)
      .set(admin.auth)
      .send({ isActive: false });

    expect(response.status).toBe(422);
    expect((await User.findById(admin.user._id))?.isActive).toBe(true);
  });

  it("refuses a librarian with 403", async () => {
    const librarian = await loginAs("librarian");
    const member = await loginAs("member");

    const response = await request(app)
      .patch(`/api/users/${member.user._id}/active`)
      .set(librarian.auth)
      .send({ isActive: false });

    expect(response.status).toBe(403);
  });

  it("returns 400 when isActive is not a boolean", async () => {
    const admin = await loginAs("admin");
    const member = await loginAs("member");

    const response = await request(app)
      .patch(`/api/users/${member.user._id}/active`)
      .set(admin.auth)
      .send({ isActive: "no" });

    expect(response.status).toBe(400);
  });
});
