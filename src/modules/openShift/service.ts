import {
  findOpenShiftsByCompany,
  findOpenShiftById,
  createOpenShift,
  updateOpenShift,
  deleteOpenShift,
  clearOpenShiftFromShifts,
  OpenShift,
} from "./model";
import { findShiftsByOpenShiftId } from "../shift/model";
import { addShift } from "../shift/service";
import { findDepartmentById } from "../department/model";
import { findShiftTypeById } from "../shiftType/model";
import { findUserSummaryById } from "../user/model";
import { AppError } from "../../errors/AppError";

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
async function decorateOpenShift(slot: OpenShift) {
  const shifts = await findShiftsByOpenShiftId(slot.id);
  const filledShifts = await Promise.all(
    shifts.map(async (s) => {
      const user = await findUserSummaryById(s.userId);
      return { shiftId: s.id, userId: s.userId, userName: user?.name ?? "" };
    }),
  );
  return {
    ...slot,
    filledShifts,
    filledCount: filledShifts.length,
    remaining: Math.max(0, slot.requiredCount - filledShifts.length),
  };
}

export const listOpenShifts = async (companyId: number) => {
  const slots = await findOpenShiftsByCompany(companyId);
  return Promise.all(slots.map(decorateOpenShift));
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
// then delete the slot itself.
export const removeOpenShift = async (id: number, companyId: number) => {
  const existing = await findOpenShiftById(id);
  if (!existing || existing.companyId !== companyId) {
    throw new AppError(404, "Open shift not found");
  }
  await clearOpenShiftFromShifts(id);
  await deleteOpenShift(id);
};

// Manager-only fill: creates a real Shift via the existing addShift, so
// overlap checking, approved-leave conflict checking, and the "New Shift"
// notification all fire exactly as they do for any other assigned shift --
// there is no parallel assignment path and no employee self-claim.
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
