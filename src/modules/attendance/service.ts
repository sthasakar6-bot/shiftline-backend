import { findShiftByIdForUser } from "../shift/model";
import {
  findAttendanceByUser,
  findAttendanceByIdForUser,
  findOpenAttendanceForShift,
  createAttendance,
  setClockOut,
} from "./model";
import { AppError } from "../../errors/AppError";

export async function listAttendance(userId: number) {
  return findAttendanceByUser(userId);
}

export async function clockIn(userId: number, shiftId: number) {
  const shift = await findShiftByIdForUser(shiftId, userId);
  if (!shift) {
    throw new AppError(404, "Shift not found");
  }

  const existing = await findOpenAttendanceForShift(shiftId, userId);
  if (existing) {
    throw new AppError(409, "Already clocked in for this shift");
  }

  return createAttendance(userId, shiftId, new Date().toISOString());
}

export async function clockOut(attendanceId: number, userId: number) {
  const existing = await findAttendanceByIdForUser(attendanceId, userId);
  if (!existing) {
    throw new AppError(404, "Attendance record not found");
  }
  if (existing.clockOut) {
    throw new AppError(409, "Already clocked out");
  }

  const updated = await setClockOut(attendanceId, userId, new Date().toISOString());
  if (!updated) {
    throw new AppError(404, "Attendance record not found");
  }
  return updated;
}
