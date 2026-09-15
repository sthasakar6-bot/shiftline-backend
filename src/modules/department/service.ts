import {
  findDepartmentsByCompany,
  findDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  clearDepartmentFromUsers,
  clearDepartmentFromOpenShifts,
} from "./model";
import { AppError } from "../../errors/AppError";

export const listDepartments = async (companyId: number) => {
  return findDepartmentsByCompany(companyId);
};

export const addDepartment = async (
  companyId: number,
  data: { name: string; color: string; order?: number },
) => {
  return createDepartment({ companyId, ...data });
};

export const editDepartment = async (
  id: number,
  companyId: number,
  data: { name?: string; color?: string; order?: number },
) => {
  const existing = await findDepartmentById(id);
  if (!existing || existing.companyId !== companyId) {
    throw new AppError(404, "Department not found");
  }
  const updated = await updateDepartment(id, data);
  if (!updated) {
    throw new AppError(404, "Department not found");
  }
  return updated;
};

// Removing a department shouldn't leave employees/open shifts pointing at a
// dangling id -- detach them first (they become "Unassigned" in the roster
// grouping), then delete the row itself.
export const removeDepartment = async (id: number, companyId: number) => {
  const existing = await findDepartmentById(id);
  if (!existing || existing.companyId !== companyId) {
    throw new AppError(404, "Department not found");
  }
  await clearDepartmentFromUsers(id);
  await clearDepartmentFromOpenShifts(id);
  await deleteDepartment(id);
};
