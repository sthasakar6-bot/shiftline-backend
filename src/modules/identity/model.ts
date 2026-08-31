import { db } from "../../prisma/db";

export interface AuthUser {
  id: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  passwordHash: string;
  role: string;
  managerId: number | null;
  avatarBase64: string | null;
  phone: string | null;
  address: string | null;
  lastSeenAt: string | null;
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  return db.orm.public.User.first({ email });
}

export async function findUserById(id: number): Promise<AuthUser | null> {
  return db.orm.public.User.first({ id });
}

export async function createUser(data: {
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  passwordHash: string;
  role: string;
  managerId?: number;
  phone?: string;
  address?: string;
}): Promise<AuthUser> {
  return db.orm.public.User.create(data);
}

export async function setUserPassword(userId: number, passwordHash: string): Promise<void> {
  await db.orm.public.User.where({ id: userId }).update({ passwordHash });
}

export async function setUserPhone(userId: number, phone: string | null): Promise<void> {
  await db.orm.public.User.where({ id: userId }).update({ phone });
}

export async function touchLastSeen(userId: number): Promise<void> {
  await db.orm.public.User.where({ id: userId }).update({
    lastSeenAt: new Date().toISOString(),
  });
}
