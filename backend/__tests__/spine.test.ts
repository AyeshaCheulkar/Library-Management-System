import express from "express";
import request from "supertest";
import app from "../src/app";
import { requestLogger, redact } from "../src/middleware/requestLogger";
import { errorHandler } from "../src/middleware/errorHandler";
import { validateBody, validateObjectId } from "../src/middleware/validate";
import { ConflictError, UnprocessableError } from "../src/errors/AppError";

describe("health and headers", () => {
  it("serves /health", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("stamps both custom headers on every response", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number(response.headers["x-response-time-ms"])).toBeGreaterThanOrEqual(0);
  });

  it("gives each request its own id", async () => {
    const [first, second] = await Promise.all([
      request(app).get("/health"),
      request(app).get("/health"),
    ]);

    expect(first.headers["x-request-id"]).not.toBe(second.headers["x-request-id"]);
  });
});

describe("error envelope", () => {
  it("returns 404 in the standard shape for an unknown route", async () => {
    const response = await request(app).get("/api/nothing-here");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(typeof response.body.error.message).toBe("string");
  });

  it("echoes the request id into the error body so a report can be traced to a log line", async () => {
    const response = await request(app).get("/api/nothing-here");

    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
  });

  it("derives status and code from the thrown AppError subclass", async () => {
    const probe = express();
    probe.use(requestLogger);
    probe.get("/conflict", () => {
      throw new ConflictError("No copy available");
    });
    probe.get("/unprocessable", () => {
      throw new UnprocessableError("Borrow limit reached");
    });
    probe.use(errorHandler);

    const conflict = await request(probe).get("/conflict");
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("CONFLICT");

    const unprocessable = await request(probe).get("/unprocessable");
    expect(unprocessable.status).toBe(422);
    expect(unprocessable.body.error.code).toBe("UNPROCESSABLE");
  });

  it("never leaks an unexpected error's message to the client", async () => {
    const probe = express();
    probe.use(requestLogger);
    probe.get("/boom", () => {
      throw new Error("connection string mongodb://admin:hunter2@cluster");
    });
    probe.use(errorHandler);

    const response = await request(probe).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });
});

describe("validateBody", () => {
  const probe = express();
  probe.use(express.json());
  probe.use(requestLogger);
  probe.post(
    "/register",
    validateBody({
      email: { type: "string", required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      password: { type: "string", required: true, min: 8 },
      membershipType: { type: "string", enum: ["standard", "premium", "faculty"] },
    }),
    (req, res) => res.status(200).json(req.body)
  );
  probe.get("/books/:id", validateObjectId(), (_req, res) => res.status(200).json({ ok: true }));
  probe.use(errorHandler);

  it("strips fields the schema does not declare", async () => {
    const response = await request(probe)
      .post("/register")
      .send({ email: "a@example.com", password: "correct-horse", role: "admin", isActive: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ email: "a@example.com", password: "correct-horse" });
    expect(response.body.role).toBeUndefined();
  });

  it("rejects a NoSQL injection payload before it can reach a query", async () => {
    const response = await request(probe)
      .post("/register")
      .send({ email: { $ne: null }, password: { $ne: null } });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.email).toBe("must be a string");
  });

  it("reports every failing field at once", async () => {
    const response = await request(probe).post("/register").send({ email: "nope", password: "x" });

    expect(response.status).toBe(400);
    expect(Object.keys(response.body.error.details.fields)).toEqual(
      expect.arrayContaining(["email", "password"])
    );
  });

  it("rejects a value outside a declared enum", async () => {
    const response = await request(probe)
      .post("/register")
      .send({ email: "a@example.com", password: "correct-horse", membershipType: "staff" });

    expect(response.status).toBe(400);
  });

  it("rejects a malformed route id with 400 rather than letting it reach a query", async () => {
    const response = await request(probe).get("/books/not-an-id");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });
});

describe("log redaction", () => {
  it("redacts secrets at any depth, keeping everything else", () => {
    const redacted = redact({
      email: "a@example.com",
      password: "hunter2",
      nested: { refreshToken: "eyJhbGciOi", passwordHash: "$2b$12$abc", keep: "visible" },
      list: [{ authorization: "Bearer abc" }],
    }) as Record<string, unknown>;

    expect(JSON.stringify(redacted)).not.toContain("hunter2");
    expect(JSON.stringify(redacted)).not.toContain("eyJhbGciOi");
    expect(JSON.stringify(redacted)).not.toContain("$2b$12$abc");
    expect(JSON.stringify(redacted)).not.toContain("Bearer abc");
    expect(redacted.email).toBe("a@example.com");
  });
});
