import { findShiftByIdForUser } from "../shift/model";
import {
  findAttendanceByUser,
  findAttendanceByIdForUser,
  findOpenAttendanceForShift,
  createAttendance,
  setClockOut,
} from "./model";
import { AppError } from "../../errors/AppError";

// Lets the client supply the actual clock-in/out instant when it was
// recorded offline and only synced later, instead of stamping it with the
// sync time. Bounded so a client can't backdate attendance arbitrarily.
const MAX_OFFLINE_HOURS = 48;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function resolveClockedAt(clockedAt?: string): string {
  if (!clockedAt) {
    return new Date().toISOString();
  }
  const provided = new Date(clockedAt);
  if (Number.isNaN(provided.getTime())) {
    throw new AppError(400, "clockedAt must be a valid date");
  }
  const now = Date.now();
  if (provided.getTime() > now + FUTURE_TOLERANCE_MS) {
    throw new AppError(400, "clockedAt cannot be in the future");
  }
  if (provided.getTime() < now - MAX_OFFLINE_HOURS * 60 * 60 * 1000) {
    throw new AppError(400, `clockedAt cannot be more than ${MAX_OFFLINE_HOURS} hours in the past`);
  }
  return provided.toISOString();
}

export async function listAttendance(userId: number) {
  return findAttendanceByUser(userId);
}

export async function clockIn(
  userId: number,
  shiftId: number,
  lat?: number,
  lng?: number,
  clockedAt?: string,
) {
  const shift = await findShiftByIdForUser(shiftId, userId);
  if (!shift) {
    throw new AppError(404, "Shift not found");
  }

  const existing = await findOpenAttendanceForShift(shiftId, userId);
  if (existing) {
    throw new AppError(409, "Already clocked in for this shift");
  }

  return createAttendance(userId, shiftId, resolveClockedAt(clockedAt), lat, lng);
}

export async function clockOut(
  attendanceId: number,
  userId: number,
  lat?: number,
  lng?: number,
  clockedAt?: string,
) {
  const existing = await findAttendanceByIdForUser(attendanceId, userId);
  if (!existing) {
    throw new AppError(404, "Attendance record not found");
  }
  if (existing.clockOut) {
    throw new AppError(409, "Already clocked out");
  }

  const resolved = resolveClockedAt(clockedAt);
  if (existing.clockIn && new Date(resolved) < new Date(existing.clockIn)) {
    throw new AppError(400, "clockedAt cannot be before clock-in");
  }

  const updated = await setClockOut(attendanceId, userId, resolved, lat, lng);
  if (!updated) {
    throw new AppError(404, "Attendance record not found");
  }
  return updated;
}
