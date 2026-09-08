import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerUser, registerAndLogin, loginUser, uniqueEmail, createCompany } from "./helpers";

describe("Multi-company isolation", () => {
  let companyAId: number;
  let companyBId: number;
  let managerA: Awaited<ReturnType<typeof registerUser>>;
  let managerAToken: string;
  let employeeA: { user: Awaited<ReturnType<typeof registerUser>>; token: string };
  let managerB: Awaited<ReturnType<typeof registerUser>>;
  let managerBToken: string;

  beforeAll(async () => {
    companyAId = await createCompany("Company A");
    companyBId = await createCompany("Company B");

    managerA = await registerUser({ email: uniqueEmail("mtenant-mgrA"), companyId: companyAId });
    await db.orm.public.User.where({ id: managerA.id }).update({ role: "manager" });
    managerAToken = await loginUser(managerA.email, managerA.password, companyAId);

    employeeA = await registerAndLogin({
      email: uniqueEmail("mtenant-empA"),
      managerId: managerA.id,
    });

    managerB = await registerUser({ email: uniqueEmail("mtenant-mgrB"), companyId: companyBId });
    await db.orm.public.User.where({ id: managerB.id }).update({ role: "manager" });
    managerBToken = await loginUser(managerB.email, managerB.password, companyBId);
  });

  it("lists companies publicly, without requiring auth", async () => {
    const res = await request(app).get("/api/companies");
    expect(res.status).toBe(200);
    const slugs = res.body.map((c: { id: number }) => c.id);
    expect(slugs).toContain(companyAId);
    expect(slugs).toContain(companyBId);
  });

  it("allows the same email to hold separate accounts in different companies", async () => {
    const sharedEmail = uniqueEmail("shared-across-companies");
    const inA = await registerUser({ email: sharedEmail, companyId: companyAId });
    const inB = await registerUser({ email: sharedEmail, companyId: companyBId });
    expect(inA.id).not.toBe(inB.id);

    const loginA = await request(app)
      .post("/api/auth/login")
      .send({ email: sharedEmail, password: inA.password, companyId: companyAId });
    expect(loginA.status).toBe(200);
    expect(loginA.body.user.id).toBe(inA.id);

    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ email: sharedEmail, password: inB.password, companyId: companyBId });
    expect(loginB.status).toBe(200);
    expect(loginB.body.user.id).toBe(inB.id);
  });

  it("rejects a login attempt against the wrong company", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: managerA.email, password: managerA.password, companyId: companyBId });
    expect(res.status).toBe(401);
  });

  it("does not show one company's employees to another company's manager", async () => {
    const res = await request(app)
      .get("/api/users/employees")
      .set("Authorization", `Bearer ${managerBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((e: { id: number }) => e.id === employeeA.user.id)).toBe(false);
  });

  it("blocks a manager from assigning another company's employee to themselves", async () => {
    const res = await request(app)
      .patch(`/api/users/${employeeA.user.id}/manager`)
      .set("Authorization", `Bearer ${managerBToken}`);
    expect(res.status).toBe(404);
  });

  it("scopes an invite (and the account it creates) to the inviting manager's company", async () => {
    const email = uniqueEmail("mtenant-invited");
    const createInvite = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${managerAToken}`)
      .send({ email });
    expect(createInvite.status).toBe(201);

    const register = await request(app).post("/api/auth/register").send({
      firstName: "Invited",
      lastName: "Employee",
      email,
      password: "password123",
      token: createInvite.body.token,
    });
    expect(register.status).toBe(201);
    expect(register.body.companyId).toBe(companyAId);

    const loginWrongCompany = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123", companyId: companyBId });
    expect(loginWrongCompany.status).toBe(401);

    const loginRightCompany = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123", companyId: companyAId });
    expect(loginRightCompany.status).toBe(200);
  });
});
