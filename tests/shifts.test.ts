import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Shifts", () => {
  let employeeToken: string;
  let managerToken: string;
  let managerId: number;
  let reportId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("shift-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerId = managerUser.id;
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const { user, token } = await registerAndLogin({
      email: uniqueEmail("shift-employee"),
      managerId: managerUser.id,
    });
    reportId = user.id;
    employeeToken = token;
  });

  it("no longer exposes self-service shift creation", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ startsAt: "2026-09-01T09:00:00Z", endsAt: "2026-09-01T17:00:00Z" });
    expect(res.status).toBe(404);
  });

  it("blocks a non-manager from assigning a shift", async () => {
    const res = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ startsAt: "2026-09-01T09:00:00Z", endsAt: "2026-09-01T17:00:00Z" });
    expect(res.status).toBe(403);
  });

  it("rejects endsAt before startsAt", async () => {
    const res = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-01T17:00:00Z", endsAt: "2026-09-01T09:00:00Z" });
    expect(res.status).toBe(400);
  });

  it("lets a manager create, and the employee view (read-only), a shift", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-01T09:00:00Z", endsAt: "2026-09-01T17:00:00Z" });
    expect(create.status).toBe(201);
    const shiftId = create.body.id;

    const list = await request(app)
      .get("/api/shifts")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((s: { id: number }) => s.id === shiftId)).toBe(true);

    const employeeTriesUpdate = await request(app)
      .patch(`/api/shifts/${shiftId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ endsAt: "2026-09-01T18:00:00Z" });
    expect(employeeTriesUpdate.status).toBe(404);

    const managerUpdate = await request(app)
      .patch(`/api/users/${reportId}/shifts/${shiftId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ endsAt: "2026-09-01T19:00:00Z" });
    expect(managerUpdate.status).toBe(200);

    const managerDelete = await request(app)
      .delete(`/api/users/${reportId}/shifts/${shiftId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(managerDelete.status).toBe(204);
  });

  it("returns 404 for a nonexistent shift", async () => {
    const res = await request(app)
      .get("/api/shifts/999999999")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(404);
  });

  it("lets a manager schedule themselves", async () => {
    const create = await request(app)
      .post(`/api/users/${managerId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-02T09:00:00Z", endsAt: "2026-09-02T17:00:00Z" });
    expect(create.status).toBe(201);
    expect(create.body.userId).toBe(managerId);
  });

  it("lets a manager set a break duration within the shift", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        startsAt: "2026-09-03T09:00:00Z",
        endsAt: "2026-09-03T17:00:00Z",
        breakMinutes: 30,
      });
    expect(create.status).toBe(201);
    expect(create.body.breakMinutes).toBe(30);
  });

  it("rejects a break longer than the shift", async () => {
    const res = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        startsAt: "2026-09-04T09:00:00Z",
        endsAt: "2026-09-04T09:10:00Z",
        breakMinutes: 60,
      });
    expect(res.status).toBe(400);
  });

  it("rejects a break duration outside the 15/30/45/60 options", async () => {
    const res = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        startsAt: "2026-09-05T09:00:00Z",
        endsAt: "2026-09-05T17:00:00Z",
        breakMinutes: 20,
      });
    expect(res.status).toBe(400);
  });

  it("rejects a shift that overlaps an existing shift for the same employee", async () => {
    const first = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-10T09:00:00Z", endsAt: "2026-09-10T17:00:00Z" });
    expect(first.status).toBe(201);

    const overlapping = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-10T12:00:00Z", endsAt: "2026-09-10T20:00:00Z" });
    expect(overlapping.status).toBe(409);
  });

  it("allows back-to-back shifts that touch but don't overlap", async () => {
    const first = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-11T09:00:00Z", endsAt: "2026-09-11T17:00:00Z" });
    expect(first.status).toBe(201);

    const backToBack = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-11T17:00:00Z", endsAt: "2026-09-11T20:00:00Z" });
    expect(backToBack.status).toBe(201);
  });

  it("rejects editing a shift into overlap with another existing shift", async () => {
    const a = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-12T09:00:00Z", endsAt: "2026-09-12T13:00:00Z" });
    const b = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-12T14:00:00Z", endsAt: "2026-09-12T18:00:00Z" });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const res = await request(app)
      .patch(`/api/users/${reportId}/shifts/${b.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-12T12:00:00Z" });
    expect(res.status).toBe(409);
  });

  it("rejects assigning a shift during an employee's approved leave", async () => {
    const leaveReq = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ type: "vacation", startDate: "2026-09-20", endDate: "2026-09-22" });
    expect(leaveReq.status).toBe(201);

    await request(app)
      .patch(`/api/users/${reportId}/leave-requests/${leaveReq.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "approved" });

    const res = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-21T09:00:00Z", endsAt: "2026-09-21T17:00:00Z" });
    expect(res.status).toBe(409);
  });

  it("allows assigning a shift during a pending (not yet approved) leave request", async () => {
    const leaveReq = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ type: "sick", startDate: "2026-09-25", endDate: "2026-09-25" });
    expect(leaveReq.status).toBe(201);

    const res = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-09-25T09:00:00Z", endsAt: "2026-09-25T17:00:00Z" });
    expect(res.status).toBe(201);
  });
});
