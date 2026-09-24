import { describe, it, expect } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { createCompany, registerAndLogin, uniqueEmail } from "./helpers";

async function createManager(companyId: number) {
  const email = uniqueEmail("manager");
  const password = "password123";
  const passwordHash = await argon2.hash(password);
  const user = await db.orm.public.User.create({
    name: "Test Manager",
    firstName: "Test",
    lastName: "Manager",
    email,
    passwordHash,
    role: "manager",
    companyId,
  });
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email, password, companyId });
  return { user, token: loginRes.body.token as string };
}

describe("GET /api/me/export", () => {
  it("returns the caller's own data without a password hash", async () => {
    const { user, token } = await registerAndLogin();
    await db.orm.public.LeaveRequest.create({
      userId: user.id,
      type: "vacation",
      startDate: "2027-01-01",
      endDate: "2027-01-02",
      status: "approved",
    });

    const res = await request(app).get("/api/me/export").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.id).toBe(user.id);
    expect(res.body.profile.passwordHash).toBeUndefined();
    expect(res.body.leaveRequests.length).toBe(1);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/me/export");
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/me", () => {
  it("deletes an employee's own account without touching the company", async () => {
    const companyId = await createCompany("Privacy Test Co Employee");
    const { user, token } = await registerAndLogin({ companyId });

    const res = await request(app).delete("/api/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.deletedCompany).toBe(false);

    const gone = await db.orm.public.User.where({ id: user.id }).first();
    expect(gone).toBeNull();
    const company = await db.orm.public.Company.first({ id: companyId });
    expect(company).not.toBeNull();
  });

  it("deletes just one manager when a co-manager remains", async () => {
    const companyId = await createCompany("Privacy Test Co Comanager");
    const { user: managerA, token: tokenA } = await createManager(companyId);
    await createManager(companyId);

    const res = await request(app).delete("/api/me").set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.deletedCompany).toBe(false);

    const gone = await db.orm.public.User.where({ id: managerA.id }).first();
    expect(gone).toBeNull();
    const company = await db.orm.public.Company.first({ id: companyId });
    expect(company).not.toBeNull();
  });

  it("cascades the whole company when the last manager deletes their account", async () => {
    const companyId = await createCompany("Privacy Test Co Last Manager");
    const { token } = await createManager(companyId);
    await registerAndLogin({ companyId });

    const res = await request(app).delete("/api/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.deletedCompany).toBe(true);

    const company = await db.orm.public.Company.first({ id: companyId });
    expect(company).toBeNull();
    const remainingUsers = await db.orm.public.User.where({ companyId }).all();
    expect(remainingUsers.length).toBe(0);
  });
});
