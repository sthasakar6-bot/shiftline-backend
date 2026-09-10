import crypto from "crypto";
import argon2 from "argon2";
import { AppError } from "../../errors/AppError";
import { findUserByEmailInCompany, findUserById, setUserPassword } from "../identity/model";
import { findAllUsersInCompany, findManagerIdsInCompany } from "../user/model";
import { notify } from "../notifications/service";
import {
  createResetRequest,
  findResetRequestByToken,
  findResetRequestById,
  findPendingRequestForUser,
  findPendingRequests,
  markRequestCompleted,
} from "./model";

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

export async function requestReset(email: string, companyId: number) {
  const user = await findUserByEmailInCompany(email, companyId);
  if (!user) {
    throw new AppError(404, "No account with that email");
  }

  const existing = await findPendingRequestForUser(user.id);
  if (existing) {
    throw new AppError(400, "A password reset request is already pending for this account");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS).toISOString();
  const request = await createResetRequest({ userId: user.id, token, expiresAt });

  // Not every account has a manager -- a bookkeeper, for instance, isn't
  // anyone's direct report -- so fall back to notifying every manager in
  // the company rather than leaving the request invisible to everyone.
  const notifyIds = user.managerId ? [user.managerId] : await findManagerIdsInCompany(user.companyId);
  await Promise.all(
    notifyIds.map((id) =>
      notify(id, `${user.name} requested a password reset.`, "Password Reset Requested", "/admin?tab=invite"),
    ),
  );

  return request;
}

// Scoped to the whole company, not just direct reports: a password reset
// isn't an approval decision the way leave is, and accounts like
// bookkeepers don't have a manager at all, so any manager in the company
// should be able to see and resolve a pending request.
export async function listPendingRequestsForCompany(companyId: number) {
  const companyUsers = await findAllUsersInCompany(companyId);
  const nameById = new Map(companyUsers.map((u) => [u.id, u.name] as const));

  const pending = await findPendingRequests();
  return pending
    .filter((r) => nameById.has(r.userId))
    .map((r) => ({ ...r, employeeName: nameById.get(r.userId) ?? "Unknown" }));
}

export async function validateResetToken(token: string) {
  const request = await findResetRequestByToken(token);
  if (!request) {
    throw new AppError(404, "Reset link not found");
  }
  if (request.status !== "pending") {
    throw new AppError(400, "This reset link has already been used");
  }
  if (new Date(request.expiresAt).getTime() < Date.now()) {
    throw new AppError(400, "This reset link has expired");
  }
  const user = await findUserById(request.userId);
  if (!user) {
    throw new AppError(404, "Account not found");
  }
  return { request, email: user.email };
}

export async function completeReset(token: string, newPassword: string) {
  const { request } = await validateResetToken(token);
  const passwordHash = await argon2.hash(newPassword);
  await setUserPassword(request.userId, passwordHash);
  await markRequestCompleted(request.id);
}

// Lets a manager set a new password directly for a pending request --
// the employee can't be expected to click a self-serve reset link if
// they're the one locked out. Scoped to the company like the listing
// above, not to direct reports only (see listPendingRequestsForCompany).
export async function resolveResetRequest(
  companyId: number,
  requestId: number,
  newPassword: string,
) {
  const request = await findResetRequestById(requestId);
  if (!request) {
    throw new AppError(404, "Reset request not found");
  }
  if (request.status !== "pending") {
    throw new AppError(400, "This reset request has already been resolved");
  }

  const user = await findUserById(request.userId);
  if (!user) {
    throw new AppError(404, "Account not found");
  }
  if (user.companyId !== companyId) {
    throw new AppError(403, "Not in your company");
  }

  const passwordHash = await argon2.hash(newPassword);
  await setUserPassword(request.userId, passwordHash);
  await markRequestCompleted(request.id);
}
