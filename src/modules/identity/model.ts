import { db } from "../../prisma/db";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  managerId: number | null;
  avatarBase64: string | null;
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  return db.orm.public.User.first({ email });
}

export async function findUserById(id: number): Promise<AuthUser | null> {
  return db.orm.public.User.first({ id });
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  managerId?: number;
}): Promise<AuthUser> {
  return db.orm.public.User.create(data);
}

export async function setUserPassword(userId: number, passwordHash: string): Promise<void> {
  await db.orm.public.User.where({ id: userId }).update({ passwordHash });
}
