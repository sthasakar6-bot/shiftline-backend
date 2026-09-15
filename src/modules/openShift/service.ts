import {
  findOpenShiftsByCompany,
  findOpenShiftById,
  createOpenShift,
  updateOpenShift,
  deleteOpenShift,
  clearOpenShiftFromShifts,
  findOpenShiftRequestsBySlot,
  findPendingOpenShiftRequestForUser,
  findOpenShiftRequestById,
  createOpenShiftRequest,
  updateOpenShiftRequestStatus,
  deleteOpenShiftRequest,
  deleteOpenShiftRequestsBySlot,
  OpenShift,
} from "./model";
import { findShiftsByOpenShiftId } from "../shift/model";
import { addShift } from "../shift/service";
import { findDepartmentById } from "../department/model";
import { findShiftTypeById } from "../shiftType/model";
import { findUserSummaryById, findManagerIdsInCompany } from "../user/model";
import { AppError } from "../../errors/AppError";
import { notify } from "../notifications/service";

async function assertDepartmentBelongsToCompany(
  departmentId: number | null | undefined,
  companyId: number,
) {
  if (!departmentId) return;
  const department = await findDepartmentById(departmentId);
  if (!department || department.companyId !== companyId) {
    throw new AppError(400, "Invalid department");
  }
}

async function assertShiftTypeBelongsToCompany(
  shiftTypeId: number | null | undefined,
  companyId: number,
) {
  if (!shiftTypeId) return;
  const shiftType = await findShiftTypeById(shiftTypeId);
  if (!shiftType || shiftType.companyId !== companyId) {
    throw new AppError(400, "Invalid shift type");
  }
}

// "Filled" is derived, not stored -- count the real Shift rows that point
// back at this slot rather than keeping a redundant counter that could
// drift out of sync (e.g. if an assigned shift is later deleted directly).
// `viewerId`, when given, adds myRequestId/myRequestStatus so an employee's
// own "My Roster" view can show their request state without a second call.
async function decorateOpenShift(slot: OpenShift, viewerId?: number) {
  const shifts = await findShiftsByOpenShiftId(slot.id);
  const filledShifts = await Promise.all(
    shifts.map(async (s) => {
      const user = await findUserSummaryById(s.userId);
      return { shiftId: s.id, userId: s.userId, userName: user?.name ?? "" };
    }),
  );
  const requestRows = await findOpenShiftRequestsBySlot(slot.id);
  const requests = await Promise.all(
    requestRows.map(async (r) => {
      const user = await findUserSummaryById(r.userId);
      return { id: r.id, userId: r.userId, userName: user?.name ?? "", status: r.status };
    }),
  );
  const mine = viewerId !== undefined ? requestRows.find((r) => r.userId === viewerId) : undefined;
  return {
    ...slot,
    filledShifts,
    filledCount: filledShifts.length,
    remaining: Math.max(0, slot.requiredCount - filledShifts.length),
    requests,
    myRequestId: mine?.id ?? null,
    myRequestStatus: mine?.status ?? null,
  };
}

// Company-wide visibility, same as the shift roster and team directory --
// any employee can see what's open, not just managers.
export const listOpenShifts = async (companyId: number, viewerId?: number) => {
  const slots = await findOpenShiftsByCompany(companyId);
  return Promise.all(slots.map((slot) => decorateOpenShift(slot, viewerId)));
};

export const addOpenShift = async (
  companyId: number,
  data: {
    departmentId?: number;
    shiftTypeId?: number;
    startsAt: string;
    endsAt: string;
    breakMinutes?: number;
    requiredCount?: number;
    notes?: string;
  },
) => {
  if (new Date(data.endsAt) <= new Date(data.startsAt)) {
    throw new AppError(400, "endsAt must be after startsAt");
  }
  await assertDepartmentBelongsToCompany(data.departmentId, companyId);
  await assertShiftTypeBelongsToCompany(data.shiftTypeId, companyId);
  const slot = await createOpenShift({ companyId, ...data });
  return decorateOpenShift(slot);
};

export const editOpenShift = async (
  id: number,
  companyId: number,
  data: {
    departmentId?: number | null;
    shiftTypeId?: number | null;
    startsAt?: string;
    endsAt?: string;
    breakMinutes?: number;
    requiredCount?: number;
    notes?: string | null;
  },
) => {
  const existing = await findOpenShiftById(id);
  if (!existing || existing.companyId !== companyId) {
    throw new AppError(404, "Open shift not found");
  }
  const startsAt = data.startsAt ?? existing.startsAt;
  const endsAt = data.endsAt ?? existing.endsAt;
  if (new Date(endsAt) <= new Date(startsAt)) {
    throw new AppError(400, "endsAt must be after startsAt");
  }
  await assertDepartmentBelongsToCompany(data.departmentId, companyId);
  await assertShiftTypeBelongsToCompany(data.shiftTypeId, companyId);
  const updated = await updateOpenShift(id, data);
  if (!updated) {
    throw new AppError(404, "Open shift not found");
  }
  return decorateOpenShift(updated);
};

// Removing a slot shouldn't delete shifts that were already assigned from
// it -- detach them first (they stay on the roster as ordinary shifts),
// then delete the slot itself. Requests, unlike shifts, are meaningless
// without their slot, so those are deleted outright.
export const removeOpenShift = async (id: number, companyId: number) => {
  const existing = await findOpenShiftById(id);
  if (!existing || existing.companyId !== companyId) {
    throw new AppError(404, "Open shift not found");
  }
  await clearOpenShiftFromShifts(id);
  await deleteOpenShiftRequestsBySlot(id);
  await deleteOpenShift(id);
};

// Manager-only fill: creates a real Shift via the existing addShift, so
// overlap checking, approved-leave conflict checking, and the "New Shift"
// notification all fire exactly as they do for any other assigned shift.
// There is no direct employee self-claim -- approveOpenShiftRequest below
// is the only other caller, once a manager approves a request.
export const assignOpenShift = async (
  id: number,
  companyId: number,
  data: { userId: number; startsAt?: string; endsAt?: string; breakMinutes?: number },
) => {
  const slot = await findOpenShiftById(id);
  if (!slot || slot.companyId !== companyId) {
    throw new AppError(404, "Open shift not found");
  }
  await addShift(data.userId, companyId, {
    startsAt: data.startsAt ?? slot.startsAt,
    endsAt: data.endsAt ?? slot.endsAt,
    breakMinutes: data.breakMinutes ?? slot.breakMinutes ?? undefined,
    shiftTypeId: slot.shiftTypeId ?? undefined,
    openShiftId: slot.id,
  });
  return decorateOpenShift(slot);
};

// Any employee can ask to fill an open slot -- it stays pending until a
// manager approves or rejects it (see approve/rejectOpenShiftRequest
// below). This is the only employee-facing write on open shifts; there is
// still no direct self-claim.
export const requestOpenShift = async (id: number, userId: number, companyId: number) => {
  const slot = await findOpenShiftById(id);
  if (!slot || slot.companyId !== companyId) {
    throw new AppError(404, "Open shift not found");
  }
  const alreadyAssigned = await findShiftsByOpenShiftId(id);
  if (alreadyAssigned.some((s) => s.userId === userId)) {
    throw new AppError(409, "You're already assigned to this shift");
  }
  const existingPending = await findPendingOpenShiftRequestForUser(id, userId);
  if (existingPending) {
    throw new AppError(409, "You've already requested this shift");
  }
  const request = await createOpenShiftRequest({ companyId, openShiftId: id, userId });
  const requester = await findUserSummaryById(userId);
  const managerIds = await findManagerIdsInCompany(companyId);
  await Promise.all(
    managerIds.map((managerId) =>
      notify(
        managerId,
        `${requester?.name ?? "An employee"} requested to fill an open shift on ${slot.startsAt.slice(0, 10)}.`,
        "Open Shift Request",
        "/admin?tab=roster",
      ),
    ),
  );
  return request;
};

export const cancelOpenShiftRequest = async (requestId: number, userId: number) => {
  const request = await findOpenShiftRequestById(requestId);
  if (!request || request.userId !== userId) {
    throw new AppError(404, "Request not found");
  }
  if (request.status !== "pending") {
    throw new AppError(409, "Only a pending request can be cancelled");
  }
  await deleteOpenShiftRequest(requestId);
};

// Approving funnels through the same assignOpenShift a manager's direct
// assign uses, so overlap/leave-conflict checks and the "New Shift"
// notification all apply here too -- if that fails (e.g. the employee
// picked up a conflicting shift since requesting), the request stays
// pending rather than silently being marked approved.
export const approveOpenShiftRequest = async (requestId: number, companyId: number) => {
  const request = await findOpenShiftRequestById(requestId);
  if (!request || request.companyId !== companyId) {
    throw new AppError(404, "Request not found");
  }
  if (request.status !== "pending") {
    throw new AppError(409, "This request has already been decided");
  }
  const slot = await assignOpenShift(request.openShiftId, companyId, { userId: request.userId });
  await updateOpenShiftRequestStatus(requestId, "approved");
  await notify(
    request.userId,
    "Your request to fill an open shift has been approved.",
    "Open Shift Request Approved",
    "/?tab=roster",
  );
  return slot;
};

export const rejectOpenShiftRequest = async (requestId: number, companyId: number) => {
  const request = await findOpenShiftRequestById(requestId);
  if (!request || request.companyId !== companyId) {
    throw new AppError(404, "Request not found");
  }
  if (request.status !== "pending") {
    throw new AppError(409, "This request has already been decided");
  }
  const updated = await updateOpenShiftRequestStatus(requestId, "rejected");
  await notify(
    request.userId,
    "Your request to fill an open shift was not approved.",
    "Open Shift Request",
    "/?tab=roster",
  );
  return updated;
};
