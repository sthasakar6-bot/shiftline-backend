import argon2 from "argon2";
import {
  findAllUsersInCompany,
  findAllEmployeesInCompany,
  findFormerEmployeesInCompany,
  findDirectReports,
  findTeamDirectory,
  findUserSummaryById,
  findUserAvatarById,
  promoteUserToManager,
  setUserManager,
  setUserActive,
  setUserAvatar,
  setUserLocation,
  setUserDepartment,
} from "./model";
import { createUser, findUserByEmailInCompany, findUserById } from "../identity/model";
import { findDepartmentById } from "../department/model";
import { AppError } from "../../errors/AppError";

export const getAllUsers = async (companyId: number) => {
  return findAllUsersInCompany(companyId);
};

export const getTeamDirectory = async (companyId: number) => {
  return findTeamDirectory(companyId);
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
  // Normalized the same way signup already normalizes its own email, so
  // login (also normalized, see identity/service.ts) can't fail just
  // because whoever typed this address in here used different casing than
  // the employee naturally types when logging in themselves.
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findUserByEmailInCompany(normalizedEmail, caller.companyId);
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
    email: normalizedEmail,
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

export const getAllEmployees = async (companyId: number, callerId: number) => {
  return findAllEmployeesInCompany(companyId, callerId);
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
// A co-manager can be deactivated the same way an employee can (they're
// both just "someone on the team" from this action's point of view) --
// only bookkeepers (their own separate flow) and the caller's own account
// are off-limits.
export const deactivateEmployee = async (targetId: number, companyId: number, callerId: number) => {
  if (targetId === callerId) {
    throw new AppError(400, "You can't remove your own account.");
  }
  const target = await findUserSummaryById(targetId);
  if (!target || target.companyId !== companyId) {
    throw new AppError(404, "User not found");
  }
  if (target.role === "bookkeeper") {
    throw new AppError(400, "Bookkeepers can't be removed this way");
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

// Which branch/site someone works out of (e.g. "Almere", "Lelystad") -- a
// manager can set it for anyone in the company, including other managers.
export const setEmployeeLocation = async (
  targetId: number,
  companyId: number,
  location: string | null,
) => {
  const target = await findUserSummaryById(targetId);
  if (!target || target.companyId !== companyId) {
    throw new AppError(404, "User not found");
  }
  const updated = await setUserLocation(targetId, location);
  if (!updated) {
    throw new AppError(404, "User not found");
  }
  return updated;
};

// Which team (e.g. "Keuken"/Kitchen) someone belongs to, for grouping the
// roster grid -- a manager can set it for anyone in the company, same shape
// as setEmployeeLocation.
export const setEmployeeDepartment = async (
  targetId: number,
  companyId: number,
  departmentId: number | null,
) => {
  const target = await findUserSummaryById(targetId);
  if (!target || target.companyId !== companyId) {
    throw new AppError(404, "User not found");
  }
  if (departmentId !== null) {
    const department = await findDepartmentById(departmentId);
    if (!department || department.companyId !== companyId) {
      throw new AppError(400, "Invalid department");
    }
  }
  const updated = await setUserDepartment(targetId, departmentId);
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
