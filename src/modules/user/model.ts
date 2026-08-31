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
  hasAvatar: boolean;
  phone: string | null;
  address: string | null;
  online: boolean;
}

const ONLINE_THRESHOLD_MS = 90 * 1000;

const SUMMARY_FIELDS = [
  "id",
  "name",
  "email",
  "role",
  "managerId",
  "avatarBase64",
  "phone",
  "address",
  "lastSeenAt",
] as const;

function toUserSummary(row: {
  id: number;
  name: string;
  email: string;
  role: string;
  managerId: number | null;
  avatarBase64: string | null;
  phone: string | null;
  address: string | null;
  lastSeenAt: string | null;
}): UserSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    managerId: row.managerId,
    hasAvatar: Boolean(row.avatarBase64),
    phone: row.phone,
    address: row.address,
    online: row.lastSeenAt !== null && Date.now() - new Date(row.lastSeenAt).getTime() < ONLINE_THRESHOLD_MS,
  };
}

export async function findAllUsers(): Promise<User[]> {
  return db.orm.public.User.select("id", "name", "email").all();
}

export async function findUserSummaryById(id: number): Promise<UserSummary | null> {
  const row = await db.orm.public.User.select(...SUMMARY_FIELDS).first({ id });
  return row ? toUserSummary(row) : null;
}

export async function findDirectReports(managerId: number): Promise<UserSummary[]> {
  const rows = await db.orm.public.User.select(...SUMMARY_FIELDS).where({ managerId }).all();
  return rows.map(toUserSummary);
}

export async function findAllEmployees(): Promise<UserSummary[]> {
  const rows = await db.orm.public.User.select(...SUMMARY_FIELDS)
    .where({ role: "employee" })
    .all();
  return rows.map(toUserSummary);
}

export async function setUserManager(
  id: number,
  managerId: number | null,
): Promise<UserSummary | null> {
  const row = await db.orm.public.User.where({ id })
    .select(...SUMMARY_FIELDS)
    .update({ managerId });
  return row ? toUserSummary(row) : null;
}

export async function promoteUserToManager(id: number): Promise<UserSummary | null> {
  const row = await db.orm.public.User.where({ id })
    .select(...SUMMARY_FIELDS)
    .update({ role: "manager" });
  return row ? toUserSummary(row) : null;
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
