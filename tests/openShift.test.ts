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

describe("Open shifts", () => {
  it("lets a manager create an open shift with filledCount 0", async () => {
    const manager = await makeManager("openshift-mgr");
    const res = await request(app)
      .post("/api/open-shifts")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        startsAt: new Date("2026-12-01T17:00:00Z").toISOString(),
        endsAt: new Date("2026-12-01T22:30:00Z").toISOString(),
        requiredCount: 1,
      });
    expect(res.status).toBe(201);
    expect(res.body.filledCount).toBe(0);
    expect(res.body.remaining).toBe(1);
    expect(res.body.filledShifts).toEqual([]);
  });

  it("assigns an employee, creating a real shift and incrementing filledCount", async () => {
    const manager = await makeManager("openshift-assignmgr");
    const employee = await registerUser({
      email: uniqueEmail("openshift-assignemp"),
      managerId: manager.id,
    });
    const slot = await request(app)
      .post("/api/open-shifts")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        startsAt: new Date("2026-12-02T09:00:00Z").toISOString(),
        endsAt: new Date("2026-12-02T17:00:00Z").toISOString(),
        requiredCount: 1,
      });

    const assignRes = await request(app)
      .post(`/api/open-shifts/${slot.body.id}/assign`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ userId: employee.id });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.filledCount).toBe(1);
    expect(assignRes.body.remaining).toBe(0);
    expect(assignRes.body.filledShifts[0].userId).toBe(employee.id);

    // The assignment created a real Shift the employee can see as their own.
    const shiftsRes = await request(app)
      .get(`/api/users/${employee.id}/shifts`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(shiftsRes.body.some((s: { id: number }) => s.id === assignRes.body.filledShifts[0].shiftId)).toBe(
      true,
    );
  });

  it("blocks assignment that overlaps the employee's existing shift", async () => {
    const manager = await makeManager("openshift-overlapmgr");
    const employee = await registerUser({
      email: uniqueEmail("openshift-overlapemp"),
      managerId: manager.id,
    });
    await request(app)
      .post(`/api/users/${employee.id}/shifts`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        startsAt: new Date("2026-12-03T09:00:00Z").toISOString(),
        endsAt: new Date("2026-12-03T17:00:00Z").toISOString(),
      });
    const slot = await request(app)
      .post("/api/open-shifts")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        startsAt: new Date("2026-12-03T12:00:00Z").toISOString(),
        endsAt: new Date("2026-12-03T20:00:00Z").toISOString(),
      });

    const assignRes = await request(app)
      .post(`/api/open-shifts/${slot.body.id}/assign`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ userId: employee.id });
    expect(assignRes.status).toBe(409);
  });

  it("blocks a non-manager from assigning an open shift", async () => {
    const manager = await makeManager("openshift-blockmgr");
    const employee = await registerUser({
      email: uniqueEmail("openshift-blockemp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const slot = await request(app)
      .post("/api/open-shifts")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        startsAt: new Date("2026-12-04T09:00:00Z").toISOString(),
        endsAt: new Date("2026-12-04T17:00:00Z").toISOString(),
      });

    const res = await request(app)
      .post(`/api/open-shifts/${slot.body.id}/assign`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ userId: employee.id });
    expect(res.status).toBe(403);
  });

  it("detaches (not deletes) the assigned shift when the slot is removed", async () => {
    const manager = await makeManager("openshift-delmgr");
    const employee = await registerUser({
      email: uniqueEmail("openshift-delemp"),
      managerId: manager.id,
    });
    const slot = await request(app)
      .post("/api/open-shifts")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        startsAt: new Date("2026-12-05T09:00:00Z").toISOString(),
        endsAt: new Date("2026-12-05T17:00:00Z").toISOString(),
      });
    const assignRes = await request(app)
      .post(`/api/open-shifts/${slot.body.id}/assign`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ userId: employee.id });
    const shiftId = assignRes.body.filledShifts[0].shiftId;

    const deleteRes = await request(app)
      .delete(`/api/open-shifts/${slot.body.id}`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(deleteRes.status).toBe(204);

    const shiftsRes = await request(app)
      .get(`/api/users/${employee.id}/shifts`)
      .set("Authorization", `Bearer ${manager.token}`);
    const listed = shiftsRes.body.find((s: { id: number }) => s.id === shiftId);
    expect(listed).toBeDefined();
    expect(listed.openShiftId ?? null).toBeNull();
  });

  it("rejects an out-of-company departmentId on open shift create", async () => {
    const companyBId = await createCompany("OpenShift Co B");
    const managerA = await makeManager("openshift-oocA");
    const managerB = await makeManager("openshift-oocB", companyBId);
    const foreignDept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${managerB.token}`)
      .send({ name: "Foreign", color: "#000000" });

    const res = await request(app)
      .post("/api/open-shifts")
      .set("Authorization", `Bearer ${managerA.token}`)
      .send({
        departmentId: foreignDept.body.id,
        startsAt: new Date("2026-12-06T09:00:00Z").toISOString(),
        endsAt: new Date("2026-12-06T17:00:00Z").toISOString(),
      });
    expect(res.status).toBe(400);
  });
});
