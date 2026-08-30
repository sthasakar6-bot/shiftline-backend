import {
  findAllUsers,
  findAllEmployees,
  findDirectReports,
  findUserSummaryById,
  findUserAvatarById,
  promoteUserToManager,
  setUserManager,
  setUserAvatar,
} from "./model";
import { AppError } from "../../errors/AppError";

export const getAllUsers = async () => {
  return findAllUsers();
};

export const getDirectReports = async (managerId: number) => {
  return findDirectReports(managerId);
};

export const getAllEmployees = async () => {
  return findAllEmployees();
};

export const promoteToManager = async (id: number) => {
  const updated = await promoteUserToManager(id);
  if (!updated) {
    throw new AppError(404, "User not found");
  }
  return updated;
};

export const assignManager = async (targetId: number, managerId: number) => {
  const target = await findUserSummaryById(targetId);
  if (!target) {
    throw new AppError(404, "User not found");
  }
  if (target.role !== "employee") {
    throw new AppError(400, "Only employees can be assigned to a manager");
  }
  const updated = await setUserManager(targetId, managerId);
  if (!updated) {
    throw new AppError(404, "User not found");
  }
  return updated;
};

export const removeFromTeam = async (targetId: number) => {
  const updated = await setUserManager(targetId, null);
  if (!updated) {
    throw new AppError(404, "User not found");
  }
  return updated;
};

export const uploadAvatar = async (userId: number, buffer: Buffer, mimeType: string) => {
  await setUserAvatar(userId, buffer.toString("base64"), mimeType);
};

export const getAvatar = async (id: number) => {
  const avatar = await findUserAvatarById(id);
  if (!avatar) {
    throw new AppError(404, "No profile picture set");
  }
  return avatar;
};
