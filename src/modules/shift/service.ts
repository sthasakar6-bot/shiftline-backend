import {
  findShiftsByUser,
  findShiftByIdForUser,
  createShift,
  updateShiftForUser,
  deleteShiftForUser,
  CreateShiftInput,
  UpdateShiftInput,
} from "./model";
import { findLeaveRequestsByUser } from "../leave/model";
import { deleteAttendanceByShiftId } from "../attendance/model";
import { AppError } from "../../errors/AppError";
import { notify } from "../notifications/service";

function validateBreakMinutes(startsAt: string, endsAt: string, breakMinutes?: number) {
  if (!breakMinutes) {
    return;
  }
  const shiftMinutes = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000;
  if (breakMinutes > shiftMinutes) {
    throw new AppError(400, "Break can't be longer than the shift");
  }
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function assertNoShiftOverlap(
  userId: number,
  startsAt: string,
  endsAt: string,
  excludeShiftId?: number,
) {
  const existing = await findShiftsByUser(userId);
  const newStart = new Date(startsAt).getTime();
  const newEnd = new Date(endsAt).getTime();
  const conflict = existing.some(
    (s) =>
      s.id !== excludeShiftId &&
      rangesOverlap(newStart, newEnd, new Date(s.startsAt).getTime(), new Date(s.endsAt).getTime()),
  );
  if (conflict) {
    throw new AppError(409, "This overlaps with another shift already assigned to this employee");
  }
}

async function assertNoApprovedLeaveConflict(userId: number, startsAt: string, endsAt: string) {
  const leaveRequests = await findLeaveRequestsByUser(userId);
  const newStart = new Date(startsAt).getTime();
  const newEnd = new Date(endsAt).getTime();
  const conflict = leaveRequests.find((l) => {
    if (l.status !== "approved") return false;
    const leaveStart = new Date(l.startDate).getTime();
    // endDate is inclusive of the whole day, so the blocked window runs
    // through the start of the following day.
    const leaveEnd = new Date(l.endDate).getTime() + 24 * 60 * 60 * 1000;
    return rangesOverlap(newStart, newEnd, leaveStart, leaveEnd);
  });
  if (conflict) {
    const label = conflict.type === "sick" ? "sick leave" : "vacation";
    throw new AppError(409, `This employee is on approved ${label} during that time`);
  }
}

export async function listShifts(userId: number) {
  return findShiftsByUser(userId);
}

export async function getShift(id: number, userId: number) {
  const shift = await findShiftByIdForUser(id, userId);
  if (!shift) {
    throw new AppError(404, "Shift not found");
  }
  return shift;
}

export async function addShift(userId: number, input: Omit<CreateShiftInput, "userId">) {
  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new AppError(400, "endsAt must be after startsAt");
  }
  validateBreakMinutes(input.startsAt, input.endsAt, input.breakMinutes);
  await assertNoShiftOverlap(userId, input.startsAt, input.endsAt);
  await assertNoApprovedLeaveConflict(userId, input.startsAt, input.endsAt);
  const shift = await createShift({ ...input, userId });
  // The exact clock time is left for the app to display (it renders in the
  // viewer's own local timezone); baking a formatted time into the message
  // here would risk showing the wrong hour to whoever reads it.
  await notify(
    userId,
    "You've been scheduled for a new shift. Open the app to see the details.",
    "New Shift",
    "/?tab=roster",
  );
  return shift;
}

export async function editShift(id: number, userId: number, input: UpdateShiftInput) {
  const existing = await findShiftByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Shift not found");
  }
  const startsAt = input.startsAt ?? existing.startsAt;
  const endsAt = input.endsAt ?? existing.endsAt;
  const breakMinutes = input.breakMinutes ?? existing.breakMinutes ?? undefined;
  validateBreakMinutes(startsAt, endsAt, breakMinutes);
  await assertNoShiftOverlap(userId, startsAt, endsAt, id);
  await assertNoApprovedLeaveConflict(userId, startsAt, endsAt);
  const updated = await updateShiftForUser(id, userId, input);
  if (!updated) {
    throw new AppError(404, "Shift not found");
  }
  return updated;
}

export async function removeShift(id: number, userId: number) {
  const existing = await findShiftByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Shift not found");
  }
  // Clock-in/out records reference the shift by id, so they'd otherwise block
  // the delete with a foreign key error -- removing a shift is expected to
  // also clear any attendance recorded against it.
  await deleteAttendanceByShiftId(id);
  await deleteShiftForUser(id, userId);
}
