import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Attendance", () => {
  let token: string;
  let managerToken: string;
  let reportId: number;
  let outsiderToken: string;
  let shiftId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("attendance-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
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
});
