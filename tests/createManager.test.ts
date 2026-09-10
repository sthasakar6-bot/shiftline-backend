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

describe("Create manager", () => {
  it("lets a manager create another manager in their own company", async () => {
    const manager = await makeManager("createmgr-mgr");
    const email = uniqueEmail("newmgr");
    const res = await request(app)
      .post("/api/users/managers")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "New", lastName: "Manager", email, password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("New Manager");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123", companyId: manager.companyId });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("manager");
    expect(login.body.user.needsOnboarding).toBe(true);
  });

  it("scopes the new manager to the caller's own company", async () => {
    const manager = await makeManager("createmgr-scope-mgr");
    const email = uniqueEmail("scopedmgr");
    const res = await request(app)
      .post("/api/users/managers")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "Scoped", lastName: "Manager", email, password: "password123" });
    expect(res.status).toBe(201);

    const created = await db.orm.public.User.first({ id: res.body.id });
    expect(created?.companyId).toBe(manager.companyId);
    expect(created?.role).toBe("manager");
  });

  it("blocks a non-manager from creating a manager", async () => {
    const manager = await makeManager("createmgr-blockmgr");
    const employee = await registerUser({
      email: uniqueEmail("createmgr-emp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const res = await request(app)
      .post("/api/users/managers")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ firstName: "Blocked", lastName: "Manager", email: uniqueEmail("blockedmgr"), password: "password123" });
    expect(res.status).toBe(403);
  });

  it("rejects creating a manager with an email already used in the company", async () => {
    const manager = await makeManager("createmgr-dupmgr");
    const email = uniqueEmail("dupmgr");
    await request(app)
      .post("/api/users/managers")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "First", lastName: "Manager", email, password: "password123" });
    const res = await request(app)
      .post("/api/users/managers")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "Second", lastName: "Manager", email, password: "password123" });
    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    const res = await request(app)
      .post("/api/users/managers")
      .send({ firstName: "No", lastName: "Auth", email: uniqueEmail("noauthmgr"), password: "password123" });
    expect(res.status).toBe(401);
  });
});
