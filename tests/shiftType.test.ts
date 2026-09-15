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
// the same worker -- keep created shift type names unique to avoid tripping
// the @@unique([companyId, name]) constraint.
function uniqueTypeName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe("Shift types", () => {
  it("lets a manager create, list, and update a shift type", async () => {
    const manager = await makeManager("stype-mgr");

    const name = uniqueTypeName("Ochtend");
    const createRes = await request(app)
      .post("/api/shift-types")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ name, color: "#22c55e" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe(name);

    const listRes = await request(app)
      .get("/api/shift-types")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(listRes.body.some((t: { id: number }) => t.id === createRes.body.id)).toBe(true);

    const updateRes = await request(app)
      .patch(`/api/shift-types/${createRes.body.id}`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ color: "#0ea5e9" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.color).toBe("#0ea5e9");
  });

  it("blocks a non-manager from creating a shift type", async () => {
    const manager = await makeManager("stype-blockmgr");
    const employee = await registerUser({
      email: uniqueEmail("stype-blockemp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const res = await request(app)
      .post("/api/shift-types")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ name: "Ochtend", color: "#22c55e" });
    expect(res.status).toBe(403);
  });

  it("rejects updating a shift type in a different company", async () => {
    const companyBId = await createCompany("ShiftType Co B");
    const managerA = await makeManager("stype-crossA");
    const managerB = await makeManager("stype-crossB", companyBId);
    const type = await request(app)
      .post("/api/shift-types")
      .set("Authorization", `Bearer ${managerB.token}`)
      .send({ name: "Nacht", color: "#6366f1" });

    const res = await request(app)
      .patch(`/api/shift-types/${type.body.id}`)
      .set("Authorization", `Bearer ${managerA.token}`)
      .send({ name: "Hacked" });
    expect(res.status).toBe(404);
  });

  it("round-trips shiftTypeId on a shift and clears it when the type is deleted", async () => {
    const manager = await makeManager("stype-shiftmgr");
    const employee = await registerUser({
      email: uniqueEmail("stype-shiftemp"),
      managerId: manager.id,
    });
    const type = await request(app)
      .post("/api/shift-types")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ name: uniqueTypeName("Day"), color: "#f59e0b" });

    const shiftRes = await request(app)
      .post(`/api/users/${employee.id}/shifts`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        startsAt: new Date("2026-11-01T09:00:00Z").toISOString(),
        endsAt: new Date("2026-11-01T17:00:00Z").toISOString(),
        shiftTypeId: type.body.id,
      });
    expect(shiftRes.status).toBe(201);
    expect(shiftRes.body.shiftTypeId).toBe(type.body.id);

    await request(app)
      .delete(`/api/shift-types/${type.body.id}`)
      .set("Authorization", `Bearer ${manager.token}`);

    const rosterRes = await request(app)
      .get("/api/shifts/roster")
      .set("Authorization", `Bearer ${manager.token}`);
    const listed = rosterRes.body.find((s: { id: number }) => s.id === shiftRes.body.id);
    expect(listed.shiftTypeId).toBeNull();
  });

  it("rejects an out-of-company shiftTypeId on shift create", async () => {
    const companyBId = await createCompany("ShiftType Co C");
    const managerA = await makeManager("stype-oocA");
    const managerB = await makeManager("stype-oocB", companyBId);
    const employee = await registerUser({
      email: uniqueEmail("stype-oocemp"),
      managerId: managerA.id,
    });
    const foreignType = await request(app)
      .post("/api/shift-types")
      .set("Authorization", `Bearer ${managerB.token}`)
      .send({ name: "Foreign", color: "#000000" });

    const res = await request(app)
      .post(`/api/users/${employee.id}/shifts`)
      .set("Authorization", `Bearer ${managerA.token}`)
      .send({
        startsAt: new Date("2026-11-02T09:00:00Z").toISOString(),
        endsAt: new Date("2026-11-02T17:00:00Z").toISOString(),
        shiftTypeId: foreignType.body.id,
      });
    expect(res.status).toBe(400);
  });
});
