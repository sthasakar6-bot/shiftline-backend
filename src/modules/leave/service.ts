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
  return createLeaveRequest({ ...input, userId });
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
  await notify(userId, `Your ${existing.type} leave request was ${decision}`);
  return updated;
}
