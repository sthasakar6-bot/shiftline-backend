import { db } from "../../prisma/db";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  managerId: number | null;
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
