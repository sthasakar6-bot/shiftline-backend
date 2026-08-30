import { db } from "../../prisma/db";

export interface PasswordResetRequest {
  id: number;
  userId: number;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export async function createResetRequest(data: {
  userId: number;
  token: string;
  expiresAt: string;
}): Promise<PasswordResetRequest> {
  return db.orm.public.PasswordResetRequest.create(data);
}

export async function findResetRequestByToken(
  token: string,
): Promise<PasswordResetRequest | null> {
  return db.orm.public.PasswordResetRequest.first({ token });
}

export async function findPendingRequestForUser(
  userId: number,
): Promise<PasswordResetRequest | null> {
  return db.orm.public.PasswordResetRequest.where({ userId, status: "pending" }).first();
}

export async function findPendingRequests(): Promise<PasswordResetRequest[]> {
  return db.orm.public.PasswordResetRequest.where({ status: "pending" }).all();
}

export async function markRequestCompleted(id: number): Promise<void> {
  await db.orm.public.PasswordResetRequest.where({ id }).update({ status: "completed" });
}
