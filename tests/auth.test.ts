import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { uniqueEmail } from "./helpers";

describe("Auth", () => {
  it("registers a new user as an employee", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Auth User", email: uniqueEmail("auth"), password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("employee");
  });

  it("ignores a self-declared role at registration", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Sneaky", email: uniqueEmail("sneaky"), password: "password123", role: "manager" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("employee");
  });

  it("rejects duplicate email", async () => {
    const email = uniqueEmail("dup");
    await request(app).post("/api/auth/register").send({ name: "Dup", email, password: "password123" });
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Dup2", email, password: "password123" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid registration input with a field-level message", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it("logs in with correct credentials", async () => {
    const email = uniqueEmail("login");
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Login User", email, password: "password123" });
    const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    const email = uniqueEmail("wrong");
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Wrong", email, password: "password123" });
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  it("requires auth for /me", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user for /me with a valid token", async () => {
    const email = uniqueEmail("me");
    await request(app).post("/api/auth/register").send({ name: "Me User", email, password: "password123" });
    const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });
});
