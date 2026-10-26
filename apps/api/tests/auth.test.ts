import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { UserModel } from "../src/db/schemas.js";
import authRouter from "../src/auth/auth.routes.js";
import { authenticateUser } from "../src/auth/rbac.middleware.js";
import { SESSION_COOKIE_NAME } from "../src/auth/jwt.service.js";

describe("Authentication & JWT Session Tests (Team Member 1 — Pawan)", () => {
  function createAuthTestServer() {
    const app = express();
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
    });
    app.use(express.json());
    app.use(cookieParser());
    app.use(limiter);
    app.use(authenticateUser);

    app.use("/api/v1/auth", authRouter);

    return app;
  }

  it("POST /auth/login with missing email or password returns 400 Bad Request", async () => {
    const app = createAuthTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });

      assert.equal(res.status, 400);
      const json = (await res.json()) as any;
      assert.match(json.error, /Missing or invalid/i);
    } finally {
      server.close();
    }
  });

  it("POST /auth/login with non-existent user returns 401 Unauthorized", async () => {
    const app = createAuthTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    // Mock UserModel.findOne to return null
    const originalFindOne = UserModel.findOne;
    UserModel.findOne = (() => Promise.resolve(null)) as any;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "unknown@example.com", password: "Password123!" }),
      });

      assert.equal(res.status, 401);
      const json = (await res.json()) as any;
      assert.match(json.error, /Invalid email or password/i);
    } finally {
      UserModel.findOne = originalFindOne;
      server.close();
    }
  });

  it("POST /auth/login with invalid password returns 401 Unauthorized", async () => {
    const app = createAuthTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("CorrectPassword123!", salt);

    const mockUser = {
      _id: "USER_TEST_1",
      name: "Test User",
      email: "test@example.com",
      passwordHash,
      role: "instructor",
      assignedSections: ["SEC_101"],
    };

    const originalFindOne = UserModel.findOne;
    UserModel.findOne = (() => Promise.resolve(mockUser)) as any;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", password: "WrongPassword!" }),
      });

      assert.equal(res.status, 401);
      const json = (await res.json()) as any;
      assert.match(json.error, /Invalid email or password/i);
    } finally {
      UserModel.findOne = originalFindOne;
      server.close();
    }
  });

  it("POST /auth/login with correct credentials returns 200, JWT token, and session cookie", async () => {
    const app = createAuthTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("CorrectPassword123!", salt);

    const mockUser = {
      _id: "INST_001",
      name: "Prof. Ananya Sen",
      email: "instructor@radar.edu",
      passwordHash,
      role: "instructor",
      departmentId: "CSE",
      sectionIds: ["SEC-CSE-101"],
      identityId: "INST_001",
    };

    const originalFindOne = UserModel.findOne;
    UserModel.findOne = (() => Promise.resolve(mockUser)) as any;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "instructor@radar.edu", password: "CorrectPassword123!" }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.status, "success");
      assert.ok(json.token, "Response must include signed JWT token");
      assert.equal(json.user.email, "instructor@radar.edu");
      assert.equal(json.user.role, "instructor");

      // Verify Set-Cookie header contains session_token
      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie, "Must set session_token cookie");
      assert.match(setCookie, new RegExp(SESSION_COOKIE_NAME));
      assert.match(setCookie, /HttpOnly/i);

      // Verify GET /auth/me using the issued token in Authorization header
      const meRes = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${json.token}` },
      });
      assert.equal(meRes.status, 200);
      const meJson = (await meRes.json()) as any;
      assert.equal(meJson.user.email, "instructor@radar.edu");
      assert.equal(meJson.user.role, "instructor");
    } finally {
      UserModel.findOne = originalFindOne;
      server.close();
    }
  });

  it("GET /auth/me without token returns 401 Unauthorized", async () => {
    const app = createAuthTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`);
      assert.equal(res.status, 401);
    } finally {
      server.close();
    }
  });

  it("POST /auth/logout clears session_token cookie", async () => {
    const app = createAuthTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/logout`, {
        method: "POST",
      });
      assert.equal(res.status, 200);
      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie);
      assert.match(setCookie, new RegExp(SESSION_COOKIE_NAME));
    } finally {
      server.close();
    }
  });
});
