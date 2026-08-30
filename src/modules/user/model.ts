import { db } from "../../prisma/db";

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: string;
  managerId: number | null;
}

export async function findAllUsers(): Promise<User[]> {
  return db.orm.public.User.select("id", "name", "email").all();
}

export async function findUserSummaryById(id: number): Promise<UserSummary | null> {
  return db.orm.public.User.select("id", "name", "email", "role", "managerId").first({ id });
}

export async function findDirectReports(managerId: number): Promise<UserSummary[]> {
  return db.orm.public.User.select("id", "name", "email", "role", "managerId")
    .where({ managerId })
    .all();
}

export async function findAllEmployees(): Promise<UserSummary[]> {
  return db.orm.public.User.select("id", "name", "email", "role", "managerId")
    .where({ role: "employee" })
    .all();
}

export async function setUserManager(
  id: number,
  managerId: number | null,
): Promise<UserSummary | null> {
  return db.orm.public.User.where({ id })
    .select("id", "name", "email", "role", "managerId")
    .update({ managerId });
}

export async function promoteUserToManager(id: number): Promise<UserSummary | null> {
  return db.orm.public.User.where({ id })
    .select("id", "name", "email", "role", "managerId")
    .update({ role: "manager" });
}

export async function setUserAvatar(
  id: number,
  avatarBase64: string,
  avatarMimeType: string,
): Promise<void> {
  await db.orm.public.User.where({ id }).update({ avatarBase64, avatarMimeType });
}

export interface UserAvatar {
  avatarBase64: string;
  avatarMimeType: string;
}

export async function findUserAvatarById(id: number): Promise<UserAvatar | null> {
  const user = await db.orm.public.User.select("avatarBase64", "avatarMimeType").first({ id });
  if (!user?.avatarBase64 || !user.avatarMimeType) return null;
  return { avatarBase64: user.avatarBase64, avatarMimeType: user.avatarMimeType };
}
