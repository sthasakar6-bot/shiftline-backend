import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Attendance", () => {
  let token: string;
  let managerToken: string;
  let managerId: number;
  let reportId: number;
  let outsiderToken: string;
  let shiftId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("attendance-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerId = managerUser.id;
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const result = await registerAndLogin({
      email: uniqueEmail("attendance-employee"),
      managerId: managerUser.id,
    });
    reportId = result.user.id;
    token = result.token;

    const outsider = await registerAndLogin({ email: uniqueEmail("attendance-outsider") });
    outsiderToken = outsider.token;

    const shift = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-10-01T09:00:00Z", endsAt: "2026-10-01T17:00:00Z" });
    shiftId = shift.body.id;
  });

  it("rejects clock-in for an unknown shift", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId: 999999999 });
    expect(res.status).toBe(404);
  });

  it("rejects a non-numeric shiftId", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId: "not-a-number" });
    expect(res.status).toBe(400);
  });

  it("clocks in, rejects a second clock-in, clocks out, rejects a second clock-out", async () => {
    const in1 = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId });
    expect(in1.status).toBe(201);
    const attendanceId = in1.body.id;

    const in2 = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId });
    expect(in2.status).toBe(409);

    const out1 = await request(app)
      .post(`/api/attendance/${attendanceId}/clock-out`)
      .set("Authorization", `Bearer ${token}`);
    expect(out1.status).toBe(200);
    expect(out1.body.clockOut).toBeTruthy();

    const out2 = await request(app)
      .post(`/api/attendance/${attendanceId}/clock-out`)
      .set("Authorization", `Bearer ${token}`);
    expect(out2.status).toBe(409);
  });

  it("accepts a client-supplied clockedAt within the offline window", async () => {
    const shift = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-10-06T09:00:00Z", endsAt: "2026-10-06T17:00:00Z" });

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const in1 = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId: shift.body.id, clockedAt: twoHoursAgo });
    expect(in1.status).toBe(201);
    expect(new Date(in1.body.clockIn).getTime()).toBeCloseTo(new Date(twoHoursAgo).getTime(), -2);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const out1 = await request(app)
      .post(`/api/attendance/${in1.body.id}/clock-out`)
      .set("Authorization", `Bearer ${token}`)
      .send({ clockedAt: oneHourAgo });
    expect(out1.status).toBe(200);
    expect(new Date(out1.body.clockOut).getTime()).toBeCloseTo(new Date(oneHourAgo).getTime(), -2);
  });

  it("rejects a clockedAt more than 48 hours in the past", async () => {
    const shift = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-10-07T09:00:00Z", endsAt: "2026-10-07T17:00:00Z" });

    const tooOld = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId: shift.body.id, clockedAt: tooOld });
    expect(res.status).toBe(400);
  });

  it("rejects a clockedAt in the future", async () => {
    const shift = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-10-08T09:00:00Z", endsAt: "2026-10-08T17:00:00Z" });

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId: shift.body.id, clockedAt: future });
    expect(res.status).toBe(400);
  });

  it("rejects a clock-out clockedAt before the clock-in time", async () => {
    const shift = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-10-09T09:00:00Z", endsAt: "2026-10-09T17:00:00Z" });

    const in1 = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId: shift.body.id });

    const before = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post(`/api/attendance/${in1.body.id}/clock-out`)
      .set("Authorization", `Bearer ${token}`)
      .send({ clockedAt: before });
    expect(res.status).toBe(400);
  });

  it("lets a manager view their report's attendance records", async () => {
    const res = await request(app)
      .get(`/api/users/${reportId}/attendance`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("blocks a non-manager from viewing another user's attendance", async () => {
    const res = await request(app)
      .get(`/api/users/${reportId}/attendance`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it("records location on clock-in and clock-out when provided", async () => {
    const shift = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-10-02T09:00:00Z", endsAt: "2026-10-02T17:00:00Z" });

    const in1 = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId: shift.body.id, lat: 40.7128, lng: -74.006 });
    expect(in1.status).toBe(201);
    expect(in1.body.clockInLat).toBe(40.7128);
    expect(in1.body.clockInLng).toBe(-74.006);

    const out1 = await request(app)
      .post(`/api/attendance/${in1.body.id}/clock-out`)
      .set("Authorization", `Bearer ${token}`)
      .send({ lat: 40.71, lng: -74.01 });
    expect(out1.status).toBe(200);
    expect(out1.body.clockOutLat).toBe(40.71);
    expect(out1.body.clockOutLng).toBe(-74.01);
  });

  it("rejects an out-of-range latitude", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({ shiftId, lat: 999, lng: 0 });
    expect(res.status).toBe(400);
  });

  it("lets a manager view their own attendance records", async () => {
    const shift = await request(app)
      .post(`/api/users/${managerId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-10-03T09:00:00Z", endsAt: "2026-10-03T17:00:00Z" });

    await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ shiftId: shift.body.id });

    const res = await request(app)
      .get(`/api/users/${managerId}/attendance`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
