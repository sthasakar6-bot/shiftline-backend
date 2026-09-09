import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { registerUser, loginUser, uniqueEmail } from "./helpers";

const MIN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function uploadAvatar(token: string) {
  await request(app)
    .post("/api/users/me/avatar")
    .set("Authorization", `Bearer ${token}`)
    .attach("avatar", MIN_PNG, { filename: "avatar.png", contentType: "image/png" });
}

async function makeManager(prefix: string) {
  const manager = await registerUser({ email: uniqueEmail(prefix) });
  const { db } = await import("../src/prisma/db");
  await db.orm.public.User.where({ id: manager.id }).update({ role: "manager" });
  const token = await loginUser(manager.email, manager.password, manager.companyId);
  return { ...manager, token };
}

async function createEmployee(managerToken: string, companyId: number) {
  const email = uniqueEmail("onboard");
  const create = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ firstName: "Onboard", lastName: "Me", email, password: "temp12345" });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "temp12345", companyId });
  return { email, companyId, token: login.body.token as string };
}

describe("Complete onboarding", () => {
  it("sets a new password and contact details, and clears needsOnboarding", async () => {
    const manager = await makeManager("onboard-mgr");
    const employee = await createEmployee(manager.token, manager.companyId);
    await uploadAvatar(employee.token);

    const res = await request(app)
      .patch("/api/auth/complete-onboarding")
      .set("Authorization", `Bearer ${employee.token}`)
      .send({ password: "newpassword123", phone: "+1 555 000 1111", address: "1 Main St" });
    expect(res.status).toBe(204);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: employee.email, password: "temp12345", companyId: employee.companyId });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: employee.email, password: "newpassword123", companyId: employee.companyId });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.needsOnboarding).toBe(false);
    expect(newLogin.body.user.phone).toBe("+1 555 000 1111");
    expect(newLogin.body.user.address).toBe("1 Main St");
  });

  it("allows completing onboarding without phone or address", async () => {
    const manager = await makeManager("onboard-nocontact-mgr");
    const employee = await createEmployee(manager.token, manager.companyId);
    await uploadAvatar(employee.token);

    const res = await request(app)
      .patch("/api/auth/complete-onboarding")
      .set("Authorization", `Bearer ${employee.token}`)
      .send({ password: "newpassword123" });
    expect(res.status).toBe(204);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: employee.email, password: "newpassword123", companyId: employee.companyId });
    expect(login.body.user.needsOnboarding).toBe(false);
  });

  it("rejects a short password", async () => {
    const manager = await makeManager("onboard-shortpw-mgr");
    const employee = await createEmployee(manager.token, manager.companyId);
    await uploadAvatar(employee.token);

    const res = await request(app)
      .patch("/api/auth/complete-onboarding")
      .set("Authorization", `Bearer ${employee.token}`)
      .send({ password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects completing onboarding without a profile picture", async () => {
    const manager = await makeManager("onboard-nophoto-mgr");
    const employee = await createEmployee(manager.token, manager.companyId);

    const res = await request(app)
      .patch("/api/auth/complete-onboarding")
      .set("Authorization", `Bearer ${employee.token}`)
      .send({ password: "newpassword123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/profile picture/i);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: employee.email, password: "temp12345", companyId: employee.companyId });
    expect(login.body.user.needsOnboarding).toBe(true);
  });

  it("requires auth", async () => {
    const res = await request(app)
      .patch("/api/auth/complete-onboarding")
      .send({ password: "newpassword123" });
    expect(res.status).toBe(401);
  });

  it("a pre-existing account (needsOnboarding false) does not need this step", async () => {
    const manager = await makeManager("onboard-preexisting-mgr");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: manager.email, password: manager.password, companyId: manager.companyId });
    expect(login.body.user.needsOnboarding).toBe(false);
  });
});
