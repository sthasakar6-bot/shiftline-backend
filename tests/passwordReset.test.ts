import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Password reset", () => {
  let managerToken: string;
  let employeeEmail: string;
  let employeePassword: string;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("pwreset-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const { user } = await registerAndLogin({
      email: uniqueEmail("pwreset-employee"),
      managerId: managerUser.id,
    });
    employeeEmail = user.email;
    employeePassword = "password123";
  });

  it("404s requesting a reset for an unknown email", async () => {
    const res = await request(app)
      .post("/api/password-reset-requests")
      .send({ email: uniqueEmail("nobody-here") });
    expect(res.status).toBe(404);
  });

  it("blocks a second pending request for the same account", async () => {
    const first = await request(app)
      .post("/api/password-reset-requests")
      .send({ email: employeeEmail });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/password-reset-requests")
      .send({ email: employeeEmail });
    expect(second.status).toBe(400);
  });

  it("lets the manager see the pending request and copy the link", async () => {
    const res = await request(app)
      .get("/api/password-reset-requests")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((r: { employeeName: string }) => r.employeeName)).toBe(true);
  });

  it("404s an unknown reset token", async () => {
    const res = await request(app).get("/api/password-reset-requests/not-a-real-token");
    expect(res.status).toBe(404);
  });

  it("lets the employee complete the reset and log in with the new password", async () => {
    const list = await request(app)
      .get("/api/password-reset-requests")
      .set("Authorization", `Bearer ${managerToken}`);
    const pending = list.body.find((r: { employeeName: string }) => r.employeeName);
    const token: string = pending.token;

    const lookup = await request(app).get(`/api/password-reset-requests/${token}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.email).toBe(employeeEmail);

    const complete = await request(app)
      .post(`/api/password-reset-requests/${token}/complete`)
      .send({ password: "brandNewPassword1" });
    expect(complete.status).toBe(204);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: employeeEmail, password: employeePassword });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: employeeEmail, password: "brandNewPassword1" });
    expect(newLogin.status).toBe(200);

    const reuse = await request(app)
      .post(`/api/password-reset-requests/${token}/complete`)
      .send({ password: "anotherPassword1" });
    expect(reuse.status).toBe(400);
  });
});

describe("Change password", () => {
  it("lets a user change their own password with the correct current password", async () => {
    const { user, token } = await registerAndLogin({ email: uniqueEmail("changepw") });

    const res = await request(app)
      .patch("/api/auth/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "password123", newPassword: "freshPassword1" });
    expect(res.status).toBe(204);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "password123" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "freshPassword1" });
    expect(newLogin.status).toBe(200);
  });

  it("rejects a wrong current password", async () => {
    const { token } = await registerAndLogin({ email: uniqueEmail("changepw-wrong") });

    const res = await request(app)
      .patch("/api/auth/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "wrongpass", newPassword: "freshPassword1" });
    expect(res.status).toBe(401);
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .patch("/api/auth/password")
      .send({ currentPassword: "x", newPassword: "freshPassword1" });
    expect(res.status).toBe(401);
  });
});
