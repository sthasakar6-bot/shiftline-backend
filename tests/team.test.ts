import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerUser, loginUser, uniqueEmail, createCompany } from "./helpers";

async function makeManager(prefix: string, companyId?: number) {
  const manager = await registerUser({ email: uniqueEmail(prefix), companyId });
  await db.orm.public.User.where({ id: manager.id }).update({ role: "manager" });
  const token = await loginUser(manager.email, manager.password, manager.companyId);
  return { ...manager, token };
}

describe("Deactivate / reactivate employees", () => {
  it("moves an employee from the active list to the former-employees list", async () => {
    const manager = await makeManager("deact-mgr");
    const employee = await registerUser({
      email: uniqueEmail("deact-emp"),
      managerId: manager.id,
    });

    const before = await request(app)
      .get("/api/users/employees")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(before.body.some((e: { id: number }) => e.id === employee.id)).toBe(true);

    const res = await request(app)
      .post(`/api/users/${employee.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);

    const after = await request(app)
      .get("/api/users/employees")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(after.body.some((e: { id: number }) => e.id === employee.id)).toBe(false);

    const former = await request(app)
      .get("/api/users/former-employees")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(former.status).toBe(200);
    expect(former.body.some((e: { id: number }) => e.id === employee.id)).toBe(true);
  });

  it("clears the manager link on deactivation", async () => {
    const manager = await makeManager("deact-linkmgr");
    const employee = await registerUser({
      email: uniqueEmail("deact-link"),
      managerId: manager.id,
    });

    await request(app)
      .post(`/api/users/${employee.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);

    const row = await db.orm.public.User.first({ id: employee.id });
    expect(row?.managerId).toBeNull();
  });

  it("blocks a deactivated employee from logging in", async () => {
    const manager = await makeManager("deact-loginmgr");
    const employee = await registerUser({
      email: uniqueEmail("deact-login"),
      managerId: manager.id,
    });

    await request(app)
      .post(`/api/users/${employee.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: employee.email, password: employee.password, companyId: employee.companyId });
    expect(login.status).toBe(403);
  });

  it("keeps historical records intact after deactivation", async () => {
    const manager = await makeManager("deact-recordsmgr");
    const employee = await registerUser({
      email: uniqueEmail("deact-records"),
      managerId: manager.id,
    });

    await request(app)
      .post(`/api/users/${employee.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);

    const row = await db.orm.public.User.first({ id: employee.id });
    expect(row).not.toBeNull();
    expect(row?.email).toBe(employee.email);
  });

  it("lets a manager reactivate a former employee", async () => {
    const manager = await makeManager("react-mgr");
    const employee = await registerUser({
      email: uniqueEmail("react-emp"),
      managerId: manager.id,
    });

    await request(app)
      .post(`/api/users/${employee.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);

    const res = await request(app)
      .post(`/api/users/${employee.id}/reactivate`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: employee.email, password: employee.password, companyId: employee.companyId });
    expect(login.status).toBe(200);

    const activeList = await request(app)
      .get("/api/users/employees")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(activeList.body.some((e: { id: number }) => e.id === employee.id)).toBe(true);

    const formerList = await request(app)
      .get("/api/users/former-employees")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(formerList.body.some((e: { id: number }) => e.id === employee.id)).toBe(false);
  });

  it("blocks a non-manager from deactivating an employee", async () => {
    const manager = await makeManager("deact-nonmgrmgr");
    const employee = await registerUser({
      email: uniqueEmail("deact-nonmgr"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);

    const res = await request(app)
      .post(`/api/users/${employee.id}/deactivate`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects deactivating a user from a different company", async () => {
    const companyBId = await createCompany("Deact Co B");
    const manager = await makeManager("deact-crossmgr");
    const otherManager = await makeManager("deact-crossmgr-other", companyBId);
    const employee = await registerUser({
      email: uniqueEmail("deact-cross"),
      managerId: otherManager.id,
    });

    const res = await request(app)
      .post(`/api/users/${employee.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(res.status).toBe(404);
  });

  // A co-manager is just another team member from this action's point of
  // view -- deactivating one is allowed the same way deactivating an
  // employee is, so a manager can actually remove a co-manager if needed.
  it("allows deactivating a co-manager", async () => {
    const manager = await makeManager("deact-mgrtargetmgr");
    const otherManager = await makeManager("deact-mgrtarget-other", manager.companyId);

    const res = await request(app)
      .post(`/api/users/${otherManager.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(res.status).toBe(200);
  });

  it("rejects deactivating your own account", async () => {
    const manager = await makeManager("deact-selfmgr");

    const res = await request(app)
      .post(`/api/users/${manager.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(res.status).toBe(400);
  });

  it("rejects deactivating a bookkeeper this way", async () => {
    const manager = await makeManager("deact-bkmgr");
    const bkEmail = uniqueEmail("deact-bk");
    const created = await request(app)
      .post("/api/users/bookkeepers")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "Bk", lastName: "Keeper", email: bkEmail, password: "password123" });

    const res = await request(app)
      .post(`/api/users/${created.body.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(res.status).toBe(400);
  });
});
