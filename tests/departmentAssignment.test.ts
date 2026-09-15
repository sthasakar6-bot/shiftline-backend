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

async function makeDepartment(token: string, name?: string) {
  // Managers created without an explicit companyId share the suite's default
  // test company (see helpers.ts), so a fixed name would collide with the
  // @@unique([companyId, name]) constraint across tests -- keep it unique.
  const uniqueName = name ?? `Keuken-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const res = await request(app)
    .post("/api/departments")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: uniqueName, color: "#ff5500" });
  return res.body.id as number;
}

describe("Employee department assignment", () => {
  it("lets a manager set an employee's department", async () => {
    const manager = await makeManager("deptassign-mgr");
    const employee = await registerUser({
      email: uniqueEmail("deptassign-emp"),
      managerId: manager.id,
    });
    const departmentId = await makeDepartment(manager.token);

    const res = await request(app)
      .patch(`/api/users/${employee.id}/department`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ departmentId });
    expect(res.status).toBe(200);
    expect(res.body.departmentId).toBe(departmentId);
  });

  it("lets a manager set their own department", async () => {
    const manager = await makeManager("deptassign-selfmgr");
    const departmentId = await makeDepartment(manager.token);
    const res = await request(app)
      .patch(`/api/users/${manager.id}/department`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ departmentId });
    expect(res.status).toBe(200);
    expect(res.body.departmentId).toBe(departmentId);
  });

  it("clears department with null", async () => {
    const manager = await makeManager("deptassign-clearmgr");
    const employee = await registerUser({
      email: uniqueEmail("deptassign-clearemp"),
      managerId: manager.id,
    });
    const departmentId = await makeDepartment(manager.token);
    await request(app)
      .patch(`/api/users/${employee.id}/department`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ departmentId });
    const res = await request(app)
      .patch(`/api/users/${employee.id}/department`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ departmentId: null });
    expect(res.status).toBe(200);
    expect(res.body.departmentId).toBeNull();
  });

  it("blocks a non-manager from setting a department", async () => {
    const manager = await makeManager("deptassign-blockmgr");
    const employee = await registerUser({
      email: uniqueEmail("deptassign-blockemp"),
      managerId: manager.id,
    });
    const departmentId = await makeDepartment(manager.token);
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const res = await request(app)
      .patch(`/api/users/${employee.id}/department`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ departmentId });
    expect(res.status).toBe(403);
  });

  it("rejects setting a department for a user in a different company", async () => {
    const companyBId = await createCompany("DeptAssign Co B");
    const managerA = await makeManager("deptassign-crossA");
    const managerB = await makeManager("deptassign-crossB", companyBId);
    const outsider = await registerUser({
      email: uniqueEmail("deptassign-crossemp"),
      managerId: managerB.id,
    });
    const departmentId = await makeDepartment(managerA.token);

    const res = await request(app)
      .patch(`/api/users/${outsider.id}/department`)
      .set("Authorization", `Bearer ${managerA.token}`)
      .send({ departmentId });
    expect(res.status).toBe(404);
  });

  it("rejects a departmentId belonging to a different company", async () => {
    const companyBId = await createCompany("DeptAssign Co C");
    const managerA = await makeManager("deptassign-foreignA");
    const managerB = await makeManager("deptassign-foreignB", companyBId);
    const employee = await registerUser({
      email: uniqueEmail("deptassign-foreignemp"),
      managerId: managerA.id,
    });
    const foreignDepartmentId = await makeDepartment(managerB.token);

    const res = await request(app)
      .patch(`/api/users/${employee.id}/department`)
      .set("Authorization", `Bearer ${managerA.token}`)
      .send({ departmentId: foreignDepartmentId });
    expect(res.status).toBe(400);
  });

  it("shows the employee's department in the team directory", async () => {
    const manager = await makeManager("deptassign-teammgr");
    const employee = await registerUser({
      email: uniqueEmail("deptassign-teamemp"),
      managerId: manager.id,
    });
    const departmentId = await makeDepartment(manager.token);
    await request(app)
      .patch(`/api/users/${employee.id}/department`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ departmentId });

    const res = await request(app)
      .get("/api/users/team")
      .set("Authorization", `Bearer ${manager.token}`);
    const listed = res.body.find((m: { id: number }) => m.id === employee.id);
    expect(listed.departmentId).toBe(departmentId);
  });

  it("shows each user's department on the company roster", async () => {
    const manager = await makeManager("deptassign-rostermgr");
    const employee = await registerUser({
      email: uniqueEmail("deptassign-rosteremp"),
      managerId: manager.id,
    });
    const departmentId = await makeDepartment(manager.token);
    await request(app)
      .patch(`/api/users/${employee.id}/department`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ departmentId });
    const shift = await db.orm.public.Shift.create({
      userId: employee.id,
      startsAt: new Date("2026-10-01T09:00:00Z").toISOString(),
      endsAt: new Date("2026-10-01T17:00:00Z").toISOString(),
    });

    const res = await request(app)
      .get("/api/shifts/roster")
      .set("Authorization", `Bearer ${manager.token}`);
    const listed = res.body.find((s: { id: number }) => s.id === shift.id);
    expect(listed.userDepartmentId).toBe(departmentId);
  });
});
