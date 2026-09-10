import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail, createCompany } from "./helpers";

describe("Password reset", () => {
  let managerToken: string;
  let employeeEmail: string;
  let employeePassword: string;
  let companyId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("pwreset-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    companyId = managerUser.companyId;
    managerToken = await loginUser(managerUser.email, managerUser.password, companyId);

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
      .send({ email: uniqueEmail("nobody-here"), companyId });
    expect(res.status).toBe(404);
  });

  it("blocks a second pending request for the same account", async () => {
    const first = await request(app)
      .post("/api/password-reset-requests")
      .send({ email: employeeEmail, companyId });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/password-reset-requests")
      .send({ email: employeeEmail, companyId });
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
      .send({ email: employeeEmail, password: employeePassword, companyId });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: employeeEmail, password: "brandNewPassword1", companyId });
    expect(newLogin.status).toBe(200);

    const reuse = await request(app)
      .post(`/api/password-reset-requests/${token}/complete`)
      .send({ password: "anotherPassword1" });
    expect(reuse.status).toBe(400);
  });
});

describe("Manager resolves reset request", () => {
  it("lets the employee's manager set a new password directly", async () => {
    const managerUser = await registerUser({ email: uniqueEmail("pwresolve-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    const managerToken = await loginUser(managerUser.email, managerUser.password, managerUser.companyId);

    const { user } = await registerAndLogin({
      email: uniqueEmail("pwresolve-employee"),
      managerId: managerUser.id,
    });

    await request(app)
      .post("/api/password-reset-requests")
      .send({ email: user.email, companyId: managerUser.companyId });

    const list = await request(app)
      .get("/api/password-reset-requests")
      .set("Authorization", `Bearer ${managerToken}`);
    const pending = list.body.find((r: { userId: number }) => r.userId === user.id);

    const resolve = await request(app)
      .post(`/api/password-reset-requests/${pending.id}/resolve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ password: "managerSetPassword1" });
    expect(resolve.status).toBe(204);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "managerSetPassword1", companyId: managerUser.companyId });
    expect(newLogin.status).toBe(200);

    const reuse = await request(app)
      .post(`/api/password-reset-requests/${pending.id}/resolve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ password: "anotherPassword1" });
    expect(reuse.status).toBe(400);
  });

  it("lets a different manager in the same company resolve a request, since it's not an approval decision", async () => {
    const managerUser = await registerUser({ email: uniqueEmail("pwresolve-owner") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });

    const coManagerUser = await registerUser({
      email: uniqueEmail("pwresolve-comanager"),
      companyId: managerUser.companyId,
    });
    await db.orm.public.User.where({ id: coManagerUser.id }).update({ role: "manager" });
    const coManagerToken = await loginUser(
      coManagerUser.email,
      coManagerUser.password,
      coManagerUser.companyId,
    );

    const { user } = await registerAndLogin({
      email: uniqueEmail("pwresolve-report"),
      managerId: managerUser.id,
    });

    await request(app)
      .post("/api/password-reset-requests")
      .send({ email: user.email, companyId: managerUser.companyId });

    const list = await request(app)
      .get("/api/password-reset-requests")
      .set("Authorization", `Bearer ${coManagerToken}`);
    const pending = list.body.find((r: { userId: number }) => r.userId === user.id);

    const resolve = await request(app)
      .post(`/api/password-reset-requests/${pending.id}/resolve`)
      .set("Authorization", `Bearer ${coManagerToken}`)
      .send({ password: "coManagerSetPassword1" });
    expect(resolve.status).toBe(204);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "coManagerSetPassword1", companyId: managerUser.companyId });
    expect(newLogin.status).toBe(200);
  });

  it("blocks a manager in a different company from resolving", async () => {
    const companyAId = await createCompany(`Company A ${Date.now()}`);
    const companyBId = await createCompany(`Company B ${Date.now()}`);

    const managerUser = await registerUser({ email: uniqueEmail("pwresolve-a-manager"), companyId: companyAId });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });

    const otherManagerUser = await registerUser({
      email: uniqueEmail("pwresolve-b-manager"),
      companyId: companyBId,
    });
    await db.orm.public.User.where({ id: otherManagerUser.id }).update({ role: "manager" });
    const otherManagerToken = await loginUser(
      otherManagerUser.email,
      otherManagerUser.password,
      otherManagerUser.companyId,
    );

    const { user } = await registerAndLogin({
      email: uniqueEmail("pwresolve-victim"),
      managerId: managerUser.id,
    });

    await request(app)
      .post("/api/password-reset-requests")
      .send({ email: user.email, companyId: managerUser.companyId });

    const list = await request(app)
      .get("/api/password-reset-requests")
      .set("Authorization", `Bearer ${otherManagerToken}`);
    expect(list.body.some((r: { userId: number }) => r.userId === user.id)).toBe(false);

    // The other company's manager doesn't know the request id from their own
    // list (it's correctly filtered out above) -- fetch it directly to prove
    // the *authorization* check on resolve rejects it too, not just the list.
    const ownerList = await request(app)
      .get("/api/password-reset-requests")
      .set("Authorization", `Bearer ${await loginUser(managerUser.email, managerUser.password, managerUser.companyId)}`);
    const pending = ownerList.body.find((r: { userId: number }) => r.userId === user.id);

    const resolve = await request(app)
      .post(`/api/password-reset-requests/${pending.id}/resolve`)
      .set("Authorization", `Bearer ${otherManagerToken}`)
      .send({ password: "shouldNotWork1" });
    expect(resolve.status).toBe(403);
  });

  it("notifies every manager in the company when the account has no manager assigned (e.g. a bookkeeper)", async () => {
    const companyId = await createCompany(`Bookkeeper Co ${Date.now()}`);

    const manager1 = await registerUser({ email: uniqueEmail("pwresolve-bk-manager1"), companyId });
    await db.orm.public.User.where({ id: manager1.id }).update({ role: "manager" });
    const manager1Token = await loginUser(manager1.email, manager1.password, companyId);

    const manager2 = await registerUser({ email: uniqueEmail("pwresolve-bk-manager2"), companyId });
    await db.orm.public.User.where({ id: manager2.id }).update({ role: "manager" });
    const manager2Token = await loginUser(manager2.email, manager2.password, companyId);

    const bookkeeper = await registerUser({ email: uniqueEmail("pwresolve-bookkeeper"), companyId });
    await db.orm.public.User.where({ id: bookkeeper.id }).update({ role: "bookkeeper" });

    await request(app)
      .post("/api/password-reset-requests")
      .send({ email: bookkeeper.email, companyId });

    const list = await request(app)
      .get("/api/password-reset-requests")
      .set("Authorization", `Bearer ${manager1Token}`);
    expect(list.body.some((r: { userId: number }) => r.userId === bookkeeper.id)).toBe(true);

    for (const token of [manager1Token, manager2Token]) {
      const notifications = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${token}`);
      expect(
        notifications.body.some((n: { message: string }) => n.message.includes("requested a password reset")),
      ).toBe(true);
    }
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
      .send({ email: user.email, password: "password123", companyId: user.companyId });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "freshPassword1", companyId: user.companyId });
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
