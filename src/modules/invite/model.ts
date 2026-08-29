import { db } from "../../prisma/db";

export interface Invite {
  id: number;
  email: string;
  token: string;
  status: string;
  managerId: number;
  expiresAt: string;
  createdAt: string;
}

export async function createInvite(data: {
  email: string;
  token: string;
  managerId: number;
  expiresAt: string;
}): Promise<Invite> {
  return db.orm.public.Invite.create(data);
}

export async function findInviteByToken(token: string): Promise<Invite | null> {
  return db.orm.public.Invite.first({ token });
}

export async function findInvitesByManager(managerId: number): Promise<Invite[]> {
  return db.orm.public.Invite.where({ managerId }).all();
}

export async function findPendingInviteByEmail(email: string): Promise<Invite | null> {
  return db.orm.public.Invite.where({ email, status: "pending" }).first();
}

export async function markInviteAccepted(id: number): Promise<Invite | null> {
  return db.orm.public.Invite.where({ id }).update({ status: "accepted" });
}
