import { findShiftByIdForUser } from "../shift/model";
import {
  findAttendanceByUser,
  findAttendanceByIdForUser,
  findOpenAttendanceForShift,
  createAttendance,
  setClockOut,
  createManualAttendance,
  updateAttendanceTimes,
} from "./model";
import { AppError } from "../../errors/AppError";

// Lets the client supply the actual clock-in/out instant when it was
// recorded offline and only synced later, instead of stamping it with the
// sync time. Bounded so a client can't backdate attendance arbitrarily.
const MAX_OFFLINE_HOURS = 48;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// An employee can only clock in within this window after a shift's
// scheduled start -- past it, the clock-in option disappears and a manager
// has to add the record manually (see createManualAttendanceEntry below).
const CLOCK_IN_WINDOW_MS = 30 * 60 * 1000;

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

  const resolved = resolveClockedAt(clockedAt);
  const windowClosesAt = new Date(shift.startsAt).getTime() + CLOCK_IN_WINDOW_MS;
  if (new Date(resolved).getTime() > windowClosesAt) {
    throw new AppError(
      409,
      "The clock-in window for this shift has closed (more than 30 minutes after it started). Ask your manager to add this attendance manually.",
    );
  }

  return createAttendance(userId, shiftId, resolved, lat, lng);
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

// A manager fixing a missed punch isn't bound by the employee-facing
// clock-in window or the offline-sync backdating limit -- they're making a
// deliberate correction, not self-reporting in the moment.
export async function createManualAttendanceEntry(
  employeeId: number,
  shiftId: number,
  clockIn: string,
  clockOut?: string,
) {
  const shift = await findShiftByIdForUser(shiftId, employeeId);
  if (!shift) {
    throw new AppError(404, "Shift not found");
  }

  const existing = await findOpenAttendanceForShift(shiftId, employeeId);
  if (existing) {
    throw new AppError(409, "This shift already has an attendance record -- edit it instead");
  }

  const clockInDate = new Date(clockIn);
  if (Number.isNaN(clockInDate.getTime())) {
    throw new AppError(400, "clockIn must be a valid date");
  }

  let resolvedClockOut: string | null = null;
  if (clockOut) {
    const clockOutDate = new Date(clockOut);
    if (Number.isNaN(clockOutDate.getTime())) {
      throw new AppError(400, "clockOut must be a valid date");
    }
    if (clockOutDate < clockInDate) {
      throw new AppError(400, "clockOut cannot be before clockIn");
    }
    resolvedClockOut = clockOutDate.toISOString();
  }

  return createManualAttendance(employeeId, shiftId, clockInDate.toISOString(), resolvedClockOut);
}

export async function editManualAttendanceEntry(
  employeeId: number,
  attendanceId: number,
  clockIn: string,
  clockOut?: string,
) {
  const existing = await findAttendanceByIdForUser(attendanceId, employeeId);
  if (!existing) {
    throw new AppError(404, "Attendance record not found");
  }

  const clockInDate = new Date(clockIn);
  if (Number.isNaN(clockInDate.getTime())) {
    throw new AppError(400, "clockIn must be a valid date");
  }

  let resolvedClockOut: string | null = null;
  if (clockOut) {
    const clockOutDate = new Date(clockOut);
    if (Number.isNaN(clockOutDate.getTime())) {
      throw new AppError(400, "clockOut must be a valid date");
    }
    if (clockOutDate < clockInDate) {
      throw new AppError(400, "clockOut cannot be before clockIn");
    }
    resolvedClockOut = clockOutDate.toISOString();
  }

  const updated = await updateAttendanceTimes(attendanceId, employeeId, {
    clockIn: clockInDate.toISOString(),
    clockOut: resolvedClockOut,
  });
  if (!updated) {
    throw new AppError(404, "Attendance record not found");
  }
  return updated;
}
