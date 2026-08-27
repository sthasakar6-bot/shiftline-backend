import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { registerAndLogin } from "./helpers";

describe("Attendance", () => {
  let token: string;
  let shiftId: number;

  beforeAll(async () => {
    ({ token } = await registerAndLogin());
    const shift = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${token}`)
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
});
