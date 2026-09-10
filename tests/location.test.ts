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

describe("Employee location", () => {
  it("lets a manager set an employee's location", async () => {
    const manager = await makeManager("loc-mgr");
    const employee = await registerUser({ email: uniqueEmail("loc-emp"), managerId: manager.id });

    const res = await request(app)
      .patch(`/api/users/${employee.id}/location`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ location: "Almere" });
    expect(res.status).toBe(200);
    expect(res.body.location).toBe("Almere");
  });

  it("lets a manager set their own location", async () => {
    const manager = await makeManager("loc-selfmgr");
    const res = await request(app)
      .patch(`/api/users/${manager.id}/location`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ location: "Lelystad" });
    expect(res.status).toBe(200);
    expect(res.body.location).toBe("Lelystad");
  });

  it("clears location with null", async () => {
    const manager = await makeManager("loc-clearmgr");
    const employee = await registerUser({
      email: uniqueEmail("loc-clearemp"),
      managerId: manager.id,
    });
    await request(app)
      .patch(`/api/users/${employee.id}/location`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ location: "Almere" });
    const res = await request(app)
      .patch(`/api/users/${employee.id}/location`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ location: null });
    expect(res.status).toBe(200);
    expect(res.body.location).toBeNull();
  });

  it("blocks a non-manager from setting a location", async () => {
    const manager = await makeManager("loc-blockmgr");
    const employee = await registerUser({
      email: uniqueEmail("loc-blockemp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const res = await request(app)
      .patch(`/api/users/${employee.id}/location`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ location: "Almere" });
    expect(res.status).toBe(403);
  });

  it("rejects setting a location for a user in a different company", async () => {
    const companyBId = await createCompany("Location Co B");
    const managerA = await makeManager("loc-crossA");
    const managerB = await makeManager("loc-crossB", companyBId);
    const outsider = await registerUser({
      email: uniqueEmail("loc-crossemp"),
      managerId: managerB.id,
    });

    const res = await request(app)
      .patch(`/api/users/${outsider.id}/location`)
      .set("Authorization", `Bearer ${managerA.token}`)
      .send({ location: "Almere" });
    expect(res.status).toBe(404);
  });

  it("shows the employee's location in the team directory", async () => {
    const manager = await makeManager("loc-teammgr");
    const employee = await registerUser({
      email: uniqueEmail("loc-teamemp"),
      managerId: manager.id,
    });
    await request(app)
      .patch(`/api/users/${employee.id}/location`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ location: "Almere" });

    const res = await request(app)
      .get("/api/users/team")
      .set("Authorization", `Bearer ${manager.token}`);
    const listed = res.body.find((m: { id: number }) => m.id === employee.id);
    expect(listed.location).toBe("Almere");
  });

  it("shows each user's location on the company roster", async () => {
    const manager = await makeManager("loc-rostermgr");
    const employee = await registerUser({
      email: uniqueEmail("loc-rosteremp"),
      managerId: manager.id,
    });
    await request(app)
      .patch(`/api/users/${employee.id}/location`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ location: "Lelystad" });
    const shift = await db.orm.public.Shift.create({
      userId: employee.id,
      startsAt: new Date("2026-10-01T09:00:00Z").toISOString(),
      endsAt: new Date("2026-10-01T17:00:00Z").toISOString(),
    });

    const res = await request(app)
      .get("/api/shifts/roster")
      .set("Authorization", `Bearer ${manager.token}`);
    const listed = res.body.find((s: { id: number }) => s.id === shift.id);
    expect(listed.userLocation).toBe("Lelystad");
  });
});
