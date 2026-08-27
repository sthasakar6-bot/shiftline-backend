import { db } from "../../prisma/db";

export interface Attendance {
  id: number;
  userId: number;
  shiftId: number;
  clockIn: string | null;
  clockOut: string | null;
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
): Promise<Attendance> {
  return db.orm.public.Attendance.create({ userId, shiftId, clockIn });
}

export async function setClockOut(
  id: number,
  userId: number,
  clockOut: string,
): Promise<Attendance | null> {
  return db.orm.public.Attendance.where({ id, userId }).update({
    clockOut,
    updatedAt: new Date().toISOString(),
  });
}
