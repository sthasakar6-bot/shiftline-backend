import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Invites", () => {
  let managerToken: string;
  let managerId: number;
  let employeeToken: string;

  beforeAll(async () => {
    const manager = await registerUser({ email: uniqueEmail("invite-manager") });
    await db.orm.public.User.where({ id: manager.id }).update({ role: "manager" });
    managerId = manager.id;
    managerToken = await loginUser(manager.email, manager.password);

    const employee = await registerUser({ email: uniqueEmail("invite-emp"), managerId: manager.id });
    employeeToken = await loginUser(employee.email, employee.password);
  });

  it("lets a manager create an invite", async () => {
    const res = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: uniqueEmail("newhire") });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.token).toBeTruthy();
  });

  it("blocks a non-manager from creating an invite", async () => {
    const res = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ email: uniqueEmail("newhire2") });
    expect(res.status).toBe(403);
  });

  it("rejects inviting an email that's already registered", async () => {
    const existing = await registerUser({ email: uniqueEmail("already-here"), managerId });
    const res = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: existing.email });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate pending invites for the same email", async () => {
    const email = uniqueEmail("dupinvite");
    const first = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email });
    expect(second.status).toBe(400);
  });

  it("lets a manager list their own invites", async () => {
    const email = uniqueEmail("listedinvite");
    await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email });

    const res = await request(app).get("/api/invites").set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((i: { email: string }) => i.email === email)).toBe(true);
  });

  it("lets anyone look up an invite by token to see the invited email", async () => {
    const email = uniqueEmail("lookupinvite");
    const created = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email });

    const res = await request(app).get(`/api/invites/${created.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it("404s looking up an unknown invite token", async () => {
    const res = await request(app).get("/api/invites/not-a-real-token");
    expect(res.status).toBe(404);
  });

  it("lets an invited employee register and then blocks reusing the invite", async () => {
    const email = uniqueEmail("fullflow");
    const created = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email });

    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({
        firstName: "Full",
        lastName: "Flow",
        email,
        password: "password123",
        token: created.body.token,
      });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.role).toBe("employee");

    const reuseRes = await request(app)
      .post("/api/auth/register")
      .send({
        firstName: "Reuse",
        lastName: "User",
        email: uniqueEmail("fullflow2"),
        password: "password123",
        token: created.body.token,
      });
    expect(reuseRes.status).toBe(400);
  });
});
