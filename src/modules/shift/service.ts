import {
  findShiftsByUser,
  findShiftByIdForUser,
  createShift,
  updateShiftForUser,
  deleteShiftForUser,
  CreateShiftInput,
  UpdateShiftInput,
} from "./model";
import { AppError } from "../../errors/AppError";
import { notify } from "../notifications/service";

function validateBreakWindow(
  startsAt: string,
  endsAt: string,
  breakStart?: string,
  breakEnd?: string,
) {
  if (!breakStart && !breakEnd) {
    return;
  }
  if (!breakStart || !breakEnd) {
    throw new AppError(400, "breakStart and breakEnd must be set together");
  }
  if (new Date(breakEnd) <= new Date(breakStart)) {
    throw new AppError(400, "breakEnd must be after breakStart");
  }
  if (new Date(breakStart) < new Date(startsAt) || new Date(breakEnd) > new Date(endsAt)) {
    throw new AppError(400, "Break time must fall within the shift");
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
  validateBreakWindow(input.startsAt, input.endsAt, input.breakStart, input.breakEnd);
  const shift = await createShift({ ...input, userId });
  await notify(userId, `New shift assigned: ${input.startsAt} to ${input.endsAt}`);
  return shift;
}

export async function editShift(id: number, userId: number, input: UpdateShiftInput) {
  const existing = await findShiftByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Shift not found");
  }
  const startsAt = input.startsAt ?? existing.startsAt;
  const endsAt = input.endsAt ?? existing.endsAt;
  const breakStart = input.breakStart ?? existing.breakStart ?? undefined;
  const breakEnd = input.breakEnd ?? existing.breakEnd ?? undefined;
  validateBreakWindow(startsAt, endsAt, breakStart, breakEnd);
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
  await deleteShiftForUser(id, userId);
}
