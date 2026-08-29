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

function validateBreakMinutes(startsAt: string, endsAt: string, breakMinutes?: number) {
  if (!breakMinutes) {
    return;
  }
  const shiftMinutes = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000;
  if (breakMinutes > shiftMinutes) {
    throw new AppError(400, "Break can't be longer than the shift");
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
