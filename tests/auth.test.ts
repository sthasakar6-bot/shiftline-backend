import { describe, it, expect } from "vitest";
import request from "supertest";
import crypto from "crypto";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerUser, uniqueEmail } from "./helpers";

async function seedInvite(email: string, managerId: number, overrides: { expiresAt?: string; status?: string } = {}) {
  const token = crypto.randomBytes(16).toString("hex");
  await db.orm.public.Invite.create({
    email,
    token,
    managerId,
    status: overrides.status ?? "pending",
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  return token;
}

describe("Auth", () => {
  it("rejects registration without an invite token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "No Invite", email: uniqueEmail("noinvite"), password: "password123" });
    expect(res.status).toBe(400);
  });

  it("rejects registration with an unknown token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Bad Token",
        email: uniqueEmail("badtoken"),
        password: "password123",
        token: "not-a-real-token",
      });
    expect(res.status).toBe(404);
  });

  it("rejects registration with an expired token", async () => {
    const manager = await registerUser({ email: uniqueEmail("auth-expmgr") });
    const email = uniqueEmail("expired");
    const token = await seedInvite(email, manager.id, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Expired", email, password: "password123", token });
    expect(res.status).toBe(400);
  });

  it("rejects registration when the email doesn't match the invite", async () => {
    const manager = await registerUser({ email: uniqueEmail("auth-mismgr") });
    const token = await seedInvite(uniqueEmail("invited"), manager.id);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Mismatch", email: uniqueEmail("different"), password: "password123", token });
    expect(res.status).toBe(400);
  });

  it("registers a new user as an employee via a valid invite, ignoring a self-declared role", async () => {
    const manager = await registerUser({ email: uniqueEmail("auth-mgr") });
    const email = uniqueEmail("invited-ok");
    const token = await seedInvite(email, manager.id);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Sneaky", email, password: "password123", role: "manager", token });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("employee");
  });

  it("cannot reuse an already-accepted invite token", async () => {
    const manager = await registerUser({ email: uniqueEmail("auth-reusemgr") });
    const email = uniqueEmail("reuse");
    const token = await seedInvite(email, manager.id);
    await request(app)
      .post("/api/auth/register")
      .send({ name: "First", email, password: "password123", token });
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Second", email: uniqueEmail("reuse2"), password: "password123", token });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate email", async () => {
    const manager = await registerUser({ email: uniqueEmail("auth-dupmgr") });
    const email = uniqueEmail("dup");
    const token1 = await seedInvite(email, manager.id);
    await request(app).post("/api/auth/register").send({ name: "Dup", email, password: "password123", token: token1 });

    const token2 = await seedInvite(email, manager.id);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Dup2", email, password: "password123", token: token2 });
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
    const manager = await registerUser({ email: uniqueEmail("auth-loginmgr") });
    const email = uniqueEmail("login");
    const token = await seedInvite(email, manager.id);
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Login User", email, password: "password123", token });
    const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    const manager = await registerUser({ email: uniqueEmail("auth-wrongmgr") });
    const email = uniqueEmail("wrong");
    const inviteToken = await seedInvite(email, manager.id);
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Wrong", email, password: "password123", token: inviteToken });
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  it("requires auth for /me", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user for /me with a valid token", async () => {
    const manager = await registerUser({ email: uniqueEmail("auth-memgr") });
    const email = uniqueEmail("me");
    const inviteToken = await seedInvite(email, manager.id);
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Me User", email, password: "password123", token: inviteToken });
    const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });
});
