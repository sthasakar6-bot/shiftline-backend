import {
  findLeaveRequestsByUser,
  findLeaveRequestByIdForUser,
  createLeaveRequest,
  updateLeaveRequestStatus,
  deleteLeaveRequestForUser,
  CreateLeaveRequestInput,
} from "./model";
import { findShiftsByUser } from "../shift/model";
import { removeShift } from "../shift/service";
import { AppError } from "../../errors/AppError";
import { notify } from "../notifications/service";
import { findUserById } from "../identity/model";

const VALID_TYPES = ["vacation", "sick"];
const ACTIVE_STATUSES = ["pending", "approved"];

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function assertNoLeaveOverlap(userId: number, startDate: string, endDate: string) {
  const existing = await findLeaveRequestsByUser(userId);
  const newStart = new Date(startDate).getTime();
  const newEnd = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
  const conflict = existing.find((l) => {
    if (!ACTIVE_STATUSES.includes(l.status)) return false;
    const leaveStart = new Date(l.startDate).getTime();
    const leaveEnd = new Date(l.endDate).getTime() + 24 * 60 * 60 * 1000;
    return rangesOverlap(newStart, newEnd, leaveStart, leaveEnd);
  });
  if (conflict) {
    const label = conflict.type === "sick" ? "sick leave" : "vacation";
    throw new AppError(
      409,
      `This overlaps your ${conflict.status} ${label} request from ${conflict.startDate.slice(0, 10)} to ${conflict.endDate.slice(0, 10)}`,
    );
  }
}

export async function listLeaveRequests(userId: number) {
  return findLeaveRequestsByUser(userId);
}

export async function requestLeave(
  userId: number,
  input: Omit<CreateLeaveRequestInput, "userId">,
) {
  if (!VALID_TYPES.includes(input.type)) {
    throw new AppError(400, `type must be one of: ${VALID_TYPES.join(", ")}`);
  }
  if (new Date(input.endDate) < new Date(input.startDate)) {
    throw new AppError(400, "endDate must be on or after startDate");
  }
  await assertNoLeaveOverlap(userId, input.startDate, input.endDate);

  // Sick leave is self-certified -- it doesn't wait on a manager's decision,
  // it's approved the moment the employee reports it. The manager is just
  // notified, and any shift that day is cleared automatically the same way
  // a manager-approved conflict is. Vacation still goes through the normal
  // pending -> approved/rejected flow.
  const isSick = input.type === "sick";
  const created = await createLeaveRequest({
    ...input,
    userId,
    status: isSick ? "approved" : "pending",
  });
  if (isSick) {
    await removeConflictingShifts(userId, input.startDate, input.endDate);
  }

  const user = await findUserById(userId);
  if (user?.managerId) {
    const range = `${input.startDate.slice(0, 10)} to ${input.endDate.slice(0, 10)}`;
    const message = isSick
      ? `${user.name} called in sick from ${range}. Any scheduled shifts during that time have been removed.`
      : `${user.name} requested vacation from ${range}.`;
    await notify(user.managerId, message, isSick ? "Sick Leave" : "Leave Request", "/admin?tab=leave");
  }
  return created;
}

const SELF_DELETABLE_STATUSES = ["pending", "rejected", "cancelled"];

export async function cancelLeaveRequest(id: number, userId: number) {
  const existing = await findLeaveRequestByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Leave request not found");
  }
  if (!SELF_DELETABLE_STATUSES.includes(existing.status)) {
    throw new AppError(409, "Approved leave must be cancelled by your manager first");
  }
  await deleteLeaveRequestForUser(id, userId);
}

// Approving leave for a day the employee is already scheduled to work
// (e.g. calling in sick on a shift day) shouldn't be blocked -- the whole
// point is to cover a shift they can no longer work. Any shift(s) already
// on the books for the leave period are removed as part of approval instead
// of forcing the manager to go delete them first.
async function removeConflictingShifts(
  userId: number,
  startDate: string,
  endDate: string,
): Promise<number> {
  const shifts = await findShiftsByUser(userId);
  const leaveStart = new Date(startDate).getTime();
  const leaveEnd = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
  const conflicting = shifts.filter((s) =>
    rangesOverlap(leaveStart, leaveEnd, new Date(s.startsAt).getTime(), new Date(s.endsAt).getTime()),
  );
  for (const shift of conflicting) {
    await removeShift(shift.id, userId);
  }
  return conflicting.length;
}

export async function decideLeaveRequest(id: number, userId: number, decision: string) {
  if (decision !== "approved" && decision !== "rejected") {
    throw new AppError(400, "status must be 'approved' or 'rejected'");
  }
  const existing = await findLeaveRequestByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Leave request not found");
  }
  if (existing.status !== "pending") {
    throw new AppError(409, "This request has already been decided");
  }
  let removedShiftCount = 0;
  if (decision === "approved") {
    removedShiftCount = await removeConflictingShifts(userId, existing.startDate, existing.endDate);
  }
  const updated = await updateLeaveRequestStatus(id, userId, decision);
  if (!updated) {
    throw new AppError(404, "Leave request not found");
  }
  const shiftNote =
    removedShiftCount > 0
      ? ` Any shifts scheduled during that time have been removed from your roster.`
      : "";
  await notify(
    userId,
    `Your ${existing.type} leave request has been ${decision}.${shiftNote}`,
    "Leave Request Update",
    "/?tab=leave",
  );
  return updated;
}

export async function revokeApprovedLeave(id: number, userId: number) {
  const existing = await findLeaveRequestByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Leave request not found");
  }
  if (existing.status !== "approved") {
    throw new AppError(409, "Only approved leave can be cancelled this way");
  }
  const updated = await updateLeaveRequestStatus(id, userId, "cancelled");
  if (!updated) {
    throw new AppError(404, "Leave request not found");
  }
  const label = existing.type === "sick" ? "sick leave" : "vacation";
  await notify(
    userId,
    `Your approved ${label} has been cancelled.`,
    "Leave Cancelled",
    "/?tab=leave",
  );
  return updated;
}
