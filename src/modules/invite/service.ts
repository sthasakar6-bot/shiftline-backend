import crypto from "crypto";
import { AppError } from "../../errors/AppError";
import { findUserByEmail, findUserById } from "../identity/model";
import {
  createInvite as createInviteRecord,
  findInviteByToken,
  findInvitesByManager,
  findPendingInviteByEmail,
  markInviteAccepted,
} from "./model";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvite(managerId: number, email: string) {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new AppError(400, "A user with that email already exists");
  }

  const existingInvite = await findPendingInviteByEmail(email);
  if (existingInvite) {
    throw new AppError(400, "There is already a pending invite for that email");
  }

  const manager = await findUserById(managerId);
  if (!manager) {
    throw new AppError(404, "Manager not found");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  return createInviteRecord({ email, token, managerId, expiresAt });
}

export async function listInvites(managerId: number) {
  return findInvitesByManager(managerId);
}

export async function validateInviteToken(token: string) {
  const invite = await findInviteByToken(token);
  if (!invite) {
    throw new AppError(404, "Invite not found");
  }
  if (invite.status !== "pending") {
    throw new AppError(400, "This invite has already been used");
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new AppError(400, "This invite has expired");
  }
  return invite;
}

export async function consumeInvite(id: number) {
  await markInviteAccepted(id);
}
