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

// Managers created without an explicit companyId share the suite's default
// test company (see helpers.ts), which may be reused across test files in
// the same worker -- keep created department names unique to avoid tripping
// the @@unique([companyId, name]) constraint.
function uniqueDeptName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe("Departments", () => {
  it("lets a manager create, list, and update a department", async () => {
    const manager = await makeManager("dept-mgr");
    const name = uniqueDeptName("Keuken");

    const createRes = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ name, color: "#ff5500" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe(name);
    expect(createRes.body.color).toBe("#ff5500");

    const listRes = await request(app)
      .get("/api/departments")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(listRes.body.some((d: { id: number }) => d.id === createRes.body.id)).toBe(true);

    const updateRes = await request(app)
      .patch(`/api/departments/${createRes.body.id}`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ name: "Bediening" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe("Bediening");
  });

  it("rejects an invalid color", async () => {
    const manager = await makeManager("dept-badcolor");
    const res = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ name: "Keuken", color: "orange" });
    expect(res.status).toBe(400);
  });

  it("blocks a non-manager from creating a department", async () => {
    const manager = await makeManager("dept-blockmgr");
    const employee = await registerUser({
      email: uniqueEmail("dept-blockemp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const res = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ name: "Keuken", color: "#ff5500" });
    expect(res.status).toBe(403);
  });

  it("rejects updating a department in a different company", async () => {
    const companyBId = await createCompany("Department Co B");
    const managerA = await makeManager("dept-crossA");
    const managerB = await makeManager("dept-crossB", companyBId);
    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${managerB.token}`)
      .send({ name: "Keuken", color: "#ff5500" });

    const res = await request(app)
      .patch(`/api/departments/${dept.body.id}`)
      .set("Authorization", `Bearer ${managerA.token}`)
      .send({ name: "Hacked" });
    expect(res.status).toBe(404);
  });

  it("clears the department from its employees when deleted", async () => {
    const manager = await makeManager("dept-delmgr");
    const employee = await registerUser({
      email: uniqueEmail("dept-delemp"),
      managerId: manager.id,
    });
    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ name: uniqueDeptName("Keuken"), color: "#ff5500" });
    await request(app)
      .patch(`/api/users/${employee.id}/department`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ departmentId: dept.body.id });

    const deleteRes = await request(app)
      .delete(`/api/departments/${dept.body.id}`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(deleteRes.status).toBe(204);

    const teamRes = await request(app)
      .get("/api/users/team")
      .set("Authorization", `Bearer ${manager.token}`);
    const listed = teamRes.body.find((m: { id: number }) => m.id === employee.id);
    expect(listed.departmentId).toBeNull();
  });
});
