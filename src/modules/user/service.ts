import { findAllUsers, findDirectReports, promoteUserToManager } from "./model";
import { AppError } from "../../errors/AppError";

export const getAllUsers = async () => {
  return findAllUsers();
};

export const getDirectReports = async (managerId: number) => {
  return findDirectReports(managerId);
};

export const promoteToManager = async (id: number) => {
  const updated = await promoteUserToManager(id);
  if (!updated) {
    throw new AppError(404, "User not found");
  }
  return updated;
};
