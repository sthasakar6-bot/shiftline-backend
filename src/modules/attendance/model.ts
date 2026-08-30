import { db } from "../../prisma/db";

export interface Attendance {
  id: number;
  userId: number;
  shiftId: number;
  clockIn: string | null;
  clockOut: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  missedClockOutNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function findAttendanceByUser(userId: number): Promise<Attendance[]> {
  return db.orm.public.Attendance.where({ userId }).all();
}

export async function findAttendanceByIdForUser(
  id: number,
  userId: number,
): Promise<Attendance | null> {
  return db.orm.public.Attendance.where({ id, userId }).first();
}

export async function findOpenAttendanceForShift(
  shiftId: number,
  userId: number,
): Promise<Attendance | null> {
  return db.orm.public.Attendance.where({ shiftId, userId }).first();
}

export async function createAttendance(
  userId: number,
  shiftId: number,
  clockIn: string,
  clockInLat?: number,
  clockInLng?: number,
): Promise<Attendance> {
  return db.orm.public.Attendance.create({ userId, shiftId, clockIn, clockInLat, clockInLng });
}

export async function setClockOut(
  id: number,
  userId: number,
  clockOut: string,
  clockOutLat?: number,
  clockOutLng?: number,
): Promise<Attendance | null> {
  return db.orm.public.Attendance.where({ id, userId }).update({
    clockOut,
    clockOutLat,
    clockOutLng,
    updatedAt: new Date().toISOString(),
  });
}

export async function findOpenAttendancePendingClockOutCheck(): Promise<Attendance[]> {
  return db.orm.public.Attendance.where({
    clockOut: null,
    missedClockOutNotifiedAt: null,
  }).all();
}

export async function markMissedClockOutNotified(id: number): Promise<void> {
  await db.orm.public.Attendance.where({ id }).update({
    missedClockOutNotifiedAt: new Date().toISOString(),
  });
}
