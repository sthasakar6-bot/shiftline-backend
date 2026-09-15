import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerUser, loginUser, uniqueEmail } from "./helpers";

async function makeManager(prefix: string, companyId?: number) {
  const manager = await registerUser({ email: uniqueEmail(prefix), companyId });
  await db.orm.public.User.where({ id: manager.id }).update({ role: "manager" });
  const token = await loginUser(manager.email, manager.password, manager.companyId);
  return { ...manager, token };
}

async function makeOpenShift(managerToken: string, startsAt: string, endsAt: string) {
  const res = await request(app)
    .post("/api/open-shifts")
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ startsAt, endsAt, requiredCount: 1 });
  return res.body.id as number;
}

describe("Open shift requests", () => {
  it("lets an employee request an open shift and a manager approve it", async () => {
    const manager = await makeManager("osr-mgr");
    const employee = await registerUser({ email: uniqueEmail("osr-emp"), managerId: manager.id });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const slotId = await makeOpenShift(
      manager.token,
      new Date("2026-12-10T09:00:00Z").toISOString(),
      new Date("2026-12-10T17:00:00Z").toISOString(),
    );

    const requestRes = await request(app)
      .post(`/api/open-shifts/${slotId}/requests`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(requestRes.status).toBe(201);
    expect(requestRes.body.status).toBe("pending");

    const listRes = await request(app)
      .get("/api/open-shifts")
      .set("Authorization", `Bearer ${manager.token}`);
    const slot = listRes.body.find((s: { id: number }) => s.id === slotId);
    expect(slot.requests).toHaveLength(1);
    expect(slot.requests[0].status).toBe("pending");

    const approveRes = await request(app)
      .post(`/api/open-shift-requests/${requestRes.body.id}/approve`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.filledCount).toBe(1);
    expect(approveRes.body.filledShifts[0].userId).toBe(employee.id);

    const shiftsRes = await request(app)
      .get(`/api/users/${employee.id}/shifts`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(shiftsRes.body.some((s: { openShiftId: number }) => s.openShiftId === slotId)).toBe(true);
  });

  it("shows the employee their own request status via myRequestStatus", async () => {
    const manager = await makeManager("osr-minemgr");
    const employee = await registerUser({ email: uniqueEmail("osr-mineemp"), managerId: manager.id });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const slotId = await makeOpenShift(
      manager.token,
      new Date("2026-12-11T09:00:00Z").toISOString(),
      new Date("2026-12-11T17:00:00Z").toISOString(),
    );
    await request(app)
      .post(`/api/open-shifts/${slotId}/requests`)
      .set("Authorization", `Bearer ${employeeToken}`);

    const res = await request(app)
      .get("/api/open-shifts")
      .set("Authorization", `Bearer ${employeeToken}`);
    const slot = res.body.find((s: { id: number }) => s.id === slotId);
    expect(slot.myRequestStatus).toBe("pending");
  });

  it("lets a manager reject a request, notifying the employee", async () => {
    const manager = await makeManager("osr-rejmgr");
    const employee = await registerUser({ email: uniqueEmail("osr-rejemp"), managerId: manager.id });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const slotId = await makeOpenShift(
      manager.token,
      new Date("2026-12-12T09:00:00Z").toISOString(),
      new Date("2026-12-12T17:00:00Z").toISOString(),
    );
    const requestRes = await request(app)
      .post(`/api/open-shifts/${slotId}/requests`)
      .set("Authorization", `Bearer ${employeeToken}`);

    const rejectRes = await request(app)
      .post(`/api/open-shift-requests/${requestRes.body.id}/reject`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe("rejected");

    const notifRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(notifRes.body.some((n: { message: string }) => n.message.includes("not approved"))).toBe(
      true,
    );
  });

  it("lets an employee cancel their own pending request", async () => {
    const manager = await makeManager("osr-cancelmgr");
    const employee = await registerUser({
      email: uniqueEmail("osr-cancelemp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const slotId = await makeOpenShift(
      manager.token,
      new Date("2026-12-13T09:00:00Z").toISOString(),
      new Date("2026-12-13T17:00:00Z").toISOString(),
    );
    const requestRes = await request(app)
      .post(`/api/open-shifts/${slotId}/requests`)
      .set("Authorization", `Bearer ${employeeToken}`);

    const cancelRes = await request(app)
      .delete(`/api/open-shift-requests/${requestRes.body.id}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(cancelRes.status).toBe(204);

    const res = await request(app)
      .get("/api/open-shifts")
      .set("Authorization", `Bearer ${employeeToken}`);
    const slot = res.body.find((s: { id: number }) => s.id === slotId);
    expect(slot.myRequestStatus).toBeNull();
  });

  it("blocks requesting the same shift twice while a request is pending", async () => {
    const manager = await makeManager("osr-dupmgr");
    const employee = await registerUser({ email: uniqueEmail("osr-dupemp"), managerId: manager.id });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const slotId = await makeOpenShift(
      manager.token,
      new Date("2026-12-14T09:00:00Z").toISOString(),
      new Date("2026-12-14T17:00:00Z").toISOString(),
    );
    await request(app)
      .post(`/api/open-shifts/${slotId}/requests`)
      .set("Authorization", `Bearer ${employeeToken}`);
    const secondRes = await request(app)
      .post(`/api/open-shifts/${slotId}/requests`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(secondRes.status).toBe(409);
  });

  it("blocks a non-manager from approving or rejecting a request", async () => {
    const manager = await makeManager("osr-blockmgr");
    const employee = await registerUser({
      email: uniqueEmail("osr-blockemp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const slotId = await makeOpenShift(
      manager.token,
      new Date("2026-12-15T09:00:00Z").toISOString(),
      new Date("2026-12-15T17:00:00Z").toISOString(),
    );
    const requestRes = await request(app)
      .post(`/api/open-shifts/${slotId}/requests`)
      .set("Authorization", `Bearer ${employeeToken}`);

    const approveRes = await request(app)
      .post(`/api/open-shift-requests/${requestRes.body.id}/approve`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(approveRes.status).toBe(403);
  });

  it("deletes pending requests when the open shift slot is removed", async () => {
    const manager = await makeManager("osr-delmgr");
    const employee = await registerUser({ email: uniqueEmail("osr-delemp"), managerId: manager.id });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const slotId = await makeOpenShift(
      manager.token,
      new Date("2026-12-16T09:00:00Z").toISOString(),
      new Date("2026-12-16T17:00:00Z").toISOString(),
    );
    const requestRes = await request(app)
      .post(`/api/open-shifts/${slotId}/requests`)
      .set("Authorization", `Bearer ${employeeToken}`);

    await request(app)
      .delete(`/api/open-shifts/${slotId}`)
      .set("Authorization", `Bearer ${manager.token}`);

    const cancelRes = await request(app)
      .delete(`/api/open-shift-requests/${requestRes.body.id}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(cancelRes.status).toBe(404);
  });
});
