import crypto from "crypto";
import argon2 from "argon2";
import { AppError } from "../../errors/AppError";
import { findUserByEmail, findUserById, setUserPassword } from "../identity/model";
import { findDirectReports } from "../user/model";
import { notify } from "../notifications/service";
import {
  createResetRequest,
  findResetRequestByToken,
  findPendingRequestForUser,
  findPendingRequests,
  markRequestCompleted,
} from "./model";

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

export async function requestReset(email: string) {
  const user = await findUserByEmail(email);
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

  if (user.managerId) {
    await notify(
      user.managerId,
      `${user.name} requested a password reset.`,
      "Password Reset Requested",
      "/admin?tab=invite",
    );
  }

  return request;
}

export async function listPendingRequestsForManager(managerId: number) {
  const reports = await findDirectReports(managerId);
  const reportIds = new Set(reports.map((r) => r.id));
  const nameById = new Map(reports.map((r) => [r.id, r.name] as const));

  const pending = await findPendingRequests();
  return pending
    .filter((r) => reportIds.has(r.userId))
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
