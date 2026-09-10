import argon2 from "argon2";
import {
  findAllUsersInCompany,
  findAllEmployeesInCompany,
  findFormerEmployeesInCompany,
  findDirectReports,
  findUserSummaryById,
  findUserAvatarById,
  promoteUserToManager,
  setUserManager,
  setUserActive,
  setUserAvatar,
} from "./model";
import { createUser, findUserByEmailInCompany, findUserById } from "../identity/model";
import { AppError } from "../../errors/AppError";

export const getAllUsers = async (companyId: number) => {
  return findAllUsersInCompany(companyId);
};

// The manager sets the new account's initial password directly and hands it
// to them -- there's no email sending in this app, so a self-serve invite
// link would just be another link the manager has to copy and deliver by
// hand anyway. This skips that step and creates the account in one action.
// Shared by createEmployee / createManagerAccount / createBookkeeperAccount
// below, which differ only in role and whether managerId is set.
async function createAccountAs(
  role: "employee" | "manager" | "bookkeeper",
  callerId: number,
  firstName: string,
  lastName: string,
  email: string,
  password: string,
) {
  const caller = await findUserById(callerId);
  if (!caller) {
    throw new AppError(404, "Manager not found");
  }
  const existing = await findUserByEmailInCompany(email, caller.companyId);
  if (existing) {
    throw new AppError(400, "A user with that email already exists");
  }
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const passwordHash = await argon2.hash(password);
  const user = await createUser({
    name: `${trimmedFirst} ${trimmedLast}`.trim(),
    firstName: trimmedFirst,
    lastName: trimmedLast,
    email,
    passwordHash,
    role,
    managerId: role === "employee" ? caller.id : undefined,
    companyId: caller.companyId,
    needsOnboarding: true,
  });
  return { id: user.id, name: user.name, email: user.email };
}

export const createEmployee = (
  managerId: number,
  firstName: string,
  lastName: string,
  email: string,
  password: string,
) => createAccountAs("employee", managerId, firstName, lastName, email, password);

// Bringing on another manager -- e.g. handing full administration of a
// company over to someone else. Scoped to the calling manager's own company.
export const createManagerAccount = (
  callerId: number,
  firstName: string,
  lastName: string,
  email: string,
  password: string,
) => createAccountAs("manager", callerId, firstName, lastName, email, password);

// A bookkeeper gets a company-scoped account too, but signs into a
// completely separate, restricted UI (see the bookkeeper module) rather
// than the normal admin dashboard -- they can only upload payslips and
// contracts for this company's employees, nothing else.
export const createBookkeeperAccount = (
  callerId: number,
  firstName: string,
  lastName: string,
  email: string,
  password: string,
) => createAccountAs("bookkeeper", callerId, firstName, lastName, email, password);

export const getDirectReports = async (managerId: number) => {
  return findDirectReports(managerId);
};

export const getAllEmployees = async (companyId: number) => {
  return findAllEmployeesInCompany(companyId);
};

export const promoteToManager = async (id: number) => {
  const updated = await promoteUserToManager(id);
  if (!updated) {
    throw new AppError(404, "User not found");
  }
  return updated;
};

export const assignManager = async (targetId: number, managerId: number, companyId: number) => {
  const target = await findUserSummaryById(targetId);
  if (!target) {
    throw new AppError(404, "User not found");
  }
  if (target.companyId !== companyId) {
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

export const getFormerEmployees = async (companyId: number) => {
  return findFormerEmployeesInCompany(companyId);
};

// Deactivating drops their login and their spot on the active team roster,
// but keeps their historical records (payslips, contracts, attendance,
// shifts) intact -- they move to the former-employees list instead of
// disappearing outright, and can be reactivated if this was a mistake.
export const deactivateEmployee = async (targetId: number, companyId: number) => {
  const target = await findUserSummaryById(targetId);
  if (!target || target.companyId !== companyId) {
    throw new AppError(404, "User not found");
  }
  if (target.role !== "employee") {
    throw new AppError(400, "Only employees can be removed this way");
  }
  const updated = await setUserActive(targetId, false);
  if (!updated) {
    throw new AppError(404, "User not found");
  }
  return updated;
};

export const reactivateEmployee = async (targetId: number, companyId: number) => {
  const target = await findUserSummaryById(targetId);
  if (!target || target.companyId !== companyId) {
    throw new AppError(404, "User not found");
  }
  const updated = await setUserActive(targetId, true);
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
