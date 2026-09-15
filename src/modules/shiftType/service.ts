import {
  findShiftTypesByCompany,
  findShiftTypeById,
  createShiftType,
  updateShiftType,
  deleteShiftType,
  clearShiftTypeFromShifts,
  clearShiftTypeFromOpenShifts,
} from "./model";
import { AppError } from "../../errors/AppError";

export const listShiftTypes = async (companyId: number) => {
  return findShiftTypesByCompany(companyId);
};

export const addShiftType = async (
  companyId: number,
  data: { name: string; color: string; order?: number },
) => {
  return createShiftType({ companyId, ...data });
};

export const editShiftType = async (
  id: number,
  companyId: number,
  data: { name?: string; color?: string; order?: number },
) => {
  const existing = await findShiftTypeById(id);
  if (!existing || existing.companyId !== companyId) {
    throw new AppError(404, "Shift type not found");
  }
  const updated = await updateShiftType(id, data);
  if (!updated) {
    throw new AppError(404, "Shift type not found");
  }
  return updated;
};

// Removing a shift type shouldn't leave shifts/open shifts pointing at a
// dangling id -- detach them first (they fall back to the default chip
// color), then delete the row itself.
export const removeShiftType = async (id: number, companyId: number) => {
  const existing = await findShiftTypeById(id);
  if (!existing || existing.companyId !== companyId) {
    throw new AppError(404, "Shift type not found");
  }
  await clearShiftTypeFromShifts(id);
  await clearShiftTypeFromOpenShifts(id);
  await deleteShiftType(id);
};
