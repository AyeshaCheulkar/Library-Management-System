import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../src/app";
import { env } from "../src/config/env";
import { authenticate } from "../src/middleware/authenticate";
import { authorize } from "../src/middleware/authorize";
import { ownsMemberRecord } from "../src/middleware/ownership";
import { errorHandler } from "../src/middleware/errorHandler";
import { requestLogger } from "../src/middleware/requestLogger";
import { resetLoginRateLimit } from "../src/middleware/rateLimit";
import { issueAccessToken } from "../src/services/auth.service";
import { bearer, loginAs, PASSWORD, setCookies } from "./helpers";

const guarded = express();
guarded.use(requestLogger);
guarded.get("/librarians-only", authenticate, authorize("librarian", "admin"), (_req, res) => {
  res.status(200).json({ data: "ok" });
});
guarded.get("/members/:id/loans", authenticate, ownsMemberRecord, (_req, res) => {
  res.status(200).json({ data: [] });
});
guarded.use(errorHandler);

beforeEach(() => {
  resetLoginRateLimit();
});

describe("the six mandatory auth tests", () => {
  it("1. returns 401 for a protected endpoint with no token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("2. returns 403 for a valid token of the wrong role", async () => {
    const member = await loginAs("member");

    const response = await request(guarded).get("/librarians-only").set(member.auth);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("3. returns 403 when a member requests another member's loans", async () => {
    const alice = await loginAs("member");
    const bob = await loginAs("member");

    const own = await request(guarded).get(`/members/${alice.member.id}/loans`).set(alice.auth);
    expect(own.status).toBe(200);

    const theirs = await request(guarded).get(`/members/${bob.member.id}/loans`).set(alice.auth);
    expect(theirs.status).toBe(403);
    expect(JSON.stringify(theirs.body)).not.toContain(bob.member.name);
  });

  it("4. rejects an expired token", async () => {
    const actor = await loginAs("member");
    const expired = jwt.sign(
      { sub: actor.user._id.toString(), role: "member", ver: 0 },
      env.accessTokenSecret,
      { expiresIn: "-1s" }
    );

    const response = await request(app).get("/api/auth/me").set(bearer(expired));

    expect(response.status).toBe(401);
  });

  it("5. rejects a tampered signature", async () => {
    const actor = await loginAs("member");
    const [header, payload] = actor.accessToken.split(".");
    const tampered = `${header}.${payload}.${"x".repeat(43)}`;

    const response = await request(app).get("/api/auth/me").set(bearer(tampered));

    expect(response.status).toBe(401);
  });

  it("6. rejects a token issued before a password change", async () => {
    const actor = await loginAs("member");

    const before = await request(app).get("/api/auth/me").set(actor.auth);
    expect(before.status).toBe(200);

    const changed = await request(app)
      .patch("/api/auth/password")
      .set(actor.auth)
      .send({ currentPassword: PASSWORD, newPassword: "a-brand-new-password" });
    expect(changed.status).toBe(204);

    const after = await request(app).get("/api/auth/me").set(actor.auth);
    expect(after.status).toBe(401);
  });
});

describe("registration", () => {
  it("creates an account and a linked borrower record", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "New@Example.com", password: PASSWORD, name: "New Reader" });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe("new@example.com");
    expect(response.body.data.user.role).toBe("member");
    expect(response.body.data.accessToken).toEqual(expect.any(String));
  });

  it("never returns the password hash", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "hash@example.com", password: PASSWORD, name: "Reader" });

    expect(JSON.stringify(response.body)).not.toContain("$2b$");
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it("returns 409 when the email is already registered", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "taken@example.com", password: PASSWORD, name: "First" });

    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "taken@example.com", password: PASSWORD, name: "Second" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("returns 422 on a weak password, not 400", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "weak@example.com", password: "short", name: "Reader" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("UNPROCESSABLE");
  });

  it("returns 400 on a malformed email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: PASSWORD, name: "Reader" });

    expect(response.status).toBe(400);
  });

  it("sets the refresh token as an httpOnly cookie, and never in the body", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "cookie@example.com", password: PASSWORD, name: "Reader" });

    const cookie = setCookies(response)[0] ?? "";
    expect(cookie).toContain("refreshToken=");
    expect(cookie).toContain("HttpOnly");
    expect(response.body.data.refreshToken).toBeUndefined();
  });
});

describe("login", () => {
  it("fails identically for a wrong password and an unknown account", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "real@example.com", password: PASSWORD, name: "Real" });

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "real@example.com", password: "not-the-password" });

    const noSuchAccount = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "not-the-password" });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchAccount.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(noSuchAccount.body.error.message);
  });

  it("rejects a NoSQL injection payload rather than logging anyone in", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: { $ne: null }, password: { $ne: null } });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.email).toBe("must be a string");
  });

  it("returns 429 after five failed attempts in the window", async () => {
    const attempt = () =>
      request(app).post("/api/auth/login").send({ email: "x@example.com", password: "wrong-one" });

    for (let i = 0; i < 5; i += 1) {
      expect((await attempt()).status).toBe(401);
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("the 401 / 403 boundary", () => {
  it("returns 403 - not 401 - for a deactivated account, so the client does not retry", async () => {
    const actor = await loginAs("member", { isActive: false });

    const response = await request(app).get("/api/auth/me").set(actor.auth);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when the token's subject no longer exists", async () => {
    const actor = await loginAs("member");
    const token = issueAccessToken(actor.user);
    await actor.user.deleteOne();

    const response = await request(app).get("/api/auth/me").set(bearer(token));

    expect(response.status).toBe(401);
  });
});

describe("refresh and logout", () => {
  it("issues a new access token from the refresh cookie alone", async () => {
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ email: "refresh@example.com", password: PASSWORD, name: "Reader" });

    const cookies = setCookies(registered);
    const response = await request(app).post("/api/auth/refresh").set("Cookie", cookies);

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
  });

  it("rotates the refresh token on every use", async () => {
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ email: "rotate@example.com", password: PASSWORD, name: "Reader" });

    const first = setCookies(registered);
    const refreshed = await request(app).post("/api/auth/refresh").set("Cookie", first);

    expect(setCookies(refreshed)[0]).toContain("refreshToken=");
  });

  it("returns 401 for a refresh with no cookie", async () => {
    const response = await request(app).post("/api/auth/refresh");

    expect(response.status).toBe(401);
  });

  it("returns 204 on logout and clears the cookie", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(204);
    expect(setCookies(response)[0]).toContain("refreshToken=;");
  });
});
