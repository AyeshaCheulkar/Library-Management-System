import request from "supertest";
import app from "../src/app";
import { resetLoginRateLimit } from "../src/middleware/rateLimit";
import { loginAs, PASSWORD } from "./helpers";

const OVER_LIMIT = 6;

async function attempt(email: string, forwardedFor?: string) {
  const call = request(app).post("/api/auth/login");
  if (forwardedFor) call.set("X-Forwarded-For", forwardedFor);
  return call.send({ email, password: "wrong-on-purpose" });
}

describe("the login rate limiter", () => {
  beforeEach(() => resetLoginRateLimit());
  afterAll(() => resetLoginRateLimit());

  it("refuses the sixth attempt with 429", async () => {
    const actor = await loginAs("member");

    const codes: number[] = [];
    for (let i = 0; i < OVER_LIMIT; i += 1) {
      codes.push((await attempt(actor.user.email)).status);
    }

    expect(codes.slice(0, 5).every((code) => code === 401)).toBe(true);
    expect(codes[5]).toBe(429);
  });

  it("counts a SUCCESSFUL login too, so a known-good password cannot reset the budget", async () => {
    const actor = await loginAs("member");

    for (let i = 0; i < 4; i += 1) await attempt(actor.user.email);
    const good = await request(app)
      .post("/api/auth/login")
      .send({ email: actor.user.email, password: PASSWORD });
    expect(good.status).toBe(200);

    const sixth = await attempt(actor.user.email);
    expect(sixth.status).toBe(429);
  });

  it("ignores X-Forwarded-For while trust proxy is off, which is the safe default", async () => {
    const actor = await loginAs("member");

    const codes: number[] = [];
    for (let i = 0; i < OVER_LIMIT; i += 1) {
      codes.push((await attempt(actor.user.email, `203.0.113.${i + 1}`)).status);
    }

    expect(codes[5]).toBe(429);
  });

  it("still answers 429 through the project's own error envelope", async () => {
    const actor = await loginAs("member");
    for (let i = 0; i < OVER_LIMIT; i += 1) await attempt(actor.user.email);

    const limited = await attempt(actor.user.email);

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.body.error.requestId).toBeTruthy();
    expect(limited.headers["x-request-id"]).toBeTruthy();
  });

  it("says the same thing for a wrong password as for an unknown account", async () => {
    const actor = await loginAs("member");

    const wrongPassword = await attempt(actor.user.email);
    resetLoginRateLimit();
    const noSuchAccount = await attempt("nobody@library.test");

    expect(wrongPassword.status).toBe(noSuchAccount.status);
    expect(wrongPassword.body.error.message).toBe(noSuchAccount.body.error.message);
  });
});
