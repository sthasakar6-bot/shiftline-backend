import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerUser, loginUser, uniqueEmail } from "./helpers";

async function makeManager(prefix: string) {
  const manager = await registerUser({ email: uniqueEmail(prefix) });
  await db.orm.public.User.where({ id: manager.id }).update({ role: "manager" });
  const token = await loginUser(manager.email, manager.password, manager.companyId);
  return { ...manager, token };
}

describe("Create employee", () => {
  it("lets a manager create an employee directly", async () => {
    const manager = await makeManager("createemp-mgr");
    const email = uniqueEmail("newhire");
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "New", lastName: "Hire", email, password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("New Hire");
    expect(res.body.email).toBe(email);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123", companyId: manager.companyId });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("employee");
  });

  it("scopes the new employee to the creating manager's company and team", async () => {
    const manager = await makeManager("createemp-scope-mgr");
    const email = uniqueEmail("scoped");
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "Scoped", lastName: "Hire", email, password: "password123" });
    expect(res.status).toBe(201);

    const created = await db.orm.public.User.first({ id: res.body.id });
    expect(created?.companyId).toBe(manager.companyId);
    expect(created?.managerId).toBe(manager.id);
  });

  it("blocks a non-manager from creating an employee", async () => {
    const manager = await makeManager("createemp-blockmgr");
    const employee = await registerUser({
      email: uniqueEmail("createemp-emp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ firstName: "Blocked", lastName: "Hire", email: uniqueEmail("blocked"), password: "password123" });
    expect(res.status).toBe(403);
  });

  it("rejects creating an employee with an email already used in the company", async () => {
    const manager = await makeManager("createemp-dupmgr");
    const email = uniqueEmail("dup");
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "First", lastName: "User", email, password: "password123" });
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "Second", lastName: "User", email, password: "password123" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid input with a field-level message", async () => {
    const manager = await makeManager("createemp-invalidmgr");
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ email: "not-an-email", password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/firstName/);
  });

  it("requires auth", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ firstName: "No", lastName: "Auth", email: uniqueEmail("noauth"), password: "password123" });
    expect(res.status).toBe(401);
  });
});
