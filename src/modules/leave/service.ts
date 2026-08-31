import {
  findLeaveRequestsByUser,
  findLeaveRequestByIdForUser,
  createLeaveRequest,
  updateLeaveRequestStatus,
  deleteLeaveRequestForUser,
  CreateLeaveRequestInput,
} from "./model";
import { AppError } from "../../errors/AppError";
import { notify } from "../notifications/service";
import { findUserById } from "../identity/model";

const VALID_TYPES = ["vacation", "sick"];

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
  const created = await createLeaveRequest({ ...input, userId });
  const user = await findUserById(userId);
  if (user?.managerId) {
    const label = input.type === "sick" ? "sick leave" : "vacation";
    await notify(
      user.managerId,
      `${user.name} requested ${label} from ${input.startDate.slice(0, 10)} to ${input.endDate.slice(0, 10)}.`,
      "Leave Request",
      "/admin?tab=leave",
    );
  }
  return created;
}

export async function cancelLeaveRequest(id: number, userId: number) {
  const existing = await findLeaveRequestByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Leave request not found");
  }
  if (existing.status !== "pending") {
    throw new AppError(409, "Only pending requests can be cancelled");
  }
  await deleteLeaveRequestForUser(id, userId);
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
  const updated = await updateLeaveRequestStatus(id, userId, decision);
  if (!updated) {
    throw new AppError(404, "Leave request not found");
  }
  await notify(
    userId,
    `Your ${existing.type} leave request has been ${decision}.`,
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
