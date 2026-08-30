import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";
import { runNoShowCheck, runMissedClockOutCheck } from "../src/modules/shift/noShowService";
import { findNotificationsByUser } from "../src/modules/notifications/model";

describe("No-show check", () => {
  let managerId: number;
  let employeeId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("noshow-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerId = managerUser.id;

    const { user } = await registerAndLogin({
      email: uniqueEmail("noshow-employee"),
      managerId: managerUser.id,
    });
    employeeId = user.id;
  });

  it("does not flag a shift that hasn't started yet", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    await runNoShowCheck();

    const refreshed = await db.orm.public.Shift.where({ id: shift.id }).first();
    expect(refreshed?.noShowCheckedAt).toBeFalsy();
  });

  it("does not flag a shift still inside the 1-minute grace period", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() - 10 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    await runNoShowCheck();

    const refreshed = await db.orm.public.Shift.where({ id: shift.id }).first();
    expect(refreshed?.noShowCheckedAt).toBeFalsy();
  });

  it("notifies both employee and manager when the shift start passes with no clock-in", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() - 90 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    await runNoShowCheck();

    const refreshed = await db.orm.public.Shift.where({ id: shift.id }).first();
    expect(refreshed?.noShowCheckedAt).toBeTruthy();

    const employeeNotifications = await findNotificationsByUser(employeeId);
    expect(employeeNotifications.some((n) => n.message.includes("haven't clocked in"))).toBe(true);

    const managerNotifications = await findNotificationsByUser(managerId);
    expect(managerNotifications.some((n) => n.message.includes("hasn't clocked in"))).toBe(true);
  });

  it("does not notify again on a second run of the same shift", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() - 90 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    await runNoShowCheck();
    const before = await findNotificationsByUser(employeeId);

    await runNoShowCheck();
    const after = await findNotificationsByUser(employeeId);

    expect(after.length).toBe(before.length);
    void shift;
  });

  it("does not flag a shift the employee clocked in for", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() - 90 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    await db.orm.public.Attendance.create({
      userId: employeeId,
      shiftId: shift.id,
      clockIn: new Date(Date.now() - 80 * 1000).toISOString(),
    });

    const before = await findNotificationsByUser(employeeId);

    await runNoShowCheck();

    const after = await findNotificationsByUser(employeeId);
    expect(after.length).toBe(before.length);

    const refreshed = await db.orm.public.Shift.where({ id: shift.id }).first();
    expect(refreshed?.noShowCheckedAt).toBeTruthy();
  });
});

describe("Missed clock-out check", () => {
  let managerId: number;
  let employeeId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("noclockout-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerId = managerUser.id;

    const { user } = await registerAndLogin({
      email: uniqueEmail("noclockout-employee"),
      managerId: managerUser.id,
    });
    employeeId = user.id;
  });

  it("does not flag an open shift that hasn't ended yet", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const attendance = await db.orm.public.Attendance.create({
      userId: employeeId,
      shiftId: shift.id,
      clockIn: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    await runMissedClockOutCheck();

    const refreshed = await db.orm.public.Attendance.where({ id: attendance.id }).first();
    expect(refreshed?.missedClockOutNotifiedAt).toBeFalsy();
  });

  it("does not flag a shift still inside the 1-minute grace period after ending", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() - 10 * 1000).toISOString(),
    });
    const attendance = await db.orm.public.Attendance.create({
      userId: employeeId,
      shiftId: shift.id,
      clockIn: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    await runMissedClockOutCheck();

    const refreshed = await db.orm.public.Attendance.where({ id: attendance.id }).first();
    expect(refreshed?.missedClockOutNotifiedAt).toBeFalsy();
  });

  it("notifies both employee and manager when the shift ends with no clock-out", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() - 90 * 1000).toISOString(),
    });
    const attendance = await db.orm.public.Attendance.create({
      userId: employeeId,
      shiftId: shift.id,
      clockIn: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    await runMissedClockOutCheck();

    const refreshed = await db.orm.public.Attendance.where({ id: attendance.id }).first();
    expect(refreshed?.missedClockOutNotifiedAt).toBeTruthy();

    const employeeNotifications = await findNotificationsByUser(employeeId);
    expect(employeeNotifications.some((n) => n.message.includes("haven't clocked out"))).toBe(
      true,
    );

    const managerNotifications = await findNotificationsByUser(managerId);
    expect(managerNotifications.some((n) => n.message.includes("hasn't clocked out"))).toBe(true);
  });

  it("does not notify again on a second run of the same open attendance record", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() - 90 * 1000).toISOString(),
    });
    await db.orm.public.Attendance.create({
      userId: employeeId,
      shiftId: shift.id,
      clockIn: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    await runMissedClockOutCheck();
    const before = await findNotificationsByUser(employeeId);

    await runMissedClockOutCheck();
    const after = await findNotificationsByUser(employeeId);

    expect(after.length).toBe(before.length);
  });

  it("does not flag a record that already has a clock-out", async () => {
    const shift = await db.orm.public.Shift.create({
      userId: employeeId,
      startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() - 90 * 1000).toISOString(),
    });
    const attendance = await db.orm.public.Attendance.create({
      userId: employeeId,
      shiftId: shift.id,
      clockIn: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      clockOut: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });

    const before = await findNotificationsByUser(employeeId);

    await runMissedClockOutCheck();

    const after = await findNotificationsByUser(employeeId);
    expect(after.length).toBe(before.length);

    const refreshed = await db.orm.public.Attendance.where({ id: attendance.id }).first();
    expect(refreshed?.missedClockOutNotifiedAt).toBeFalsy();
  });
});
