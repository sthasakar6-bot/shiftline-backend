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
  companyId: number;
  avatarBase64: string | null;
  phone: string | null;
  address: string | null;
  location: string | null;
  departmentId: number | null;
  needsOnboarding: boolean;
  active: boolean;
  lastSeenAt: string | null;
}

// Case-insensitive by comparing in JS rather than relying on every email
// already being stored lowercase -- new accounts are normalized on write
// (see signup/service.ts and user/service.ts's createAccountAs), but this
// also has to work for any account created before that normalization
// existed, without a backfill migration. Companies are small teams, so
// fetching the company's users to filter in memory is cheap.
export async function findUserByEmailInCompany(
  email: string,
  companyId: number,
): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  const users = await db.orm.public.User.where({ companyId }).all();
  return users.find((u) => u.email.toLowerCase() === normalized) ?? null;
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
  companyId: number;
  phone?: string;
  address?: string;
  needsOnboarding?: boolean;
}): Promise<AuthUser> {
  return db.orm.public.User.create(data);
}

export async function setUserPassword(userId: number, passwordHash: string): Promise<void> {
  await db.orm.public.User.where({ id: userId }).update({ passwordHash });
}

export async function setUserPhone(userId: number, phone: string | null): Promise<void> {
  await db.orm.public.User.where({ id: userId }).update({ phone });
}

export async function markOnboardingComplete(
  userId: number,
  data: { passwordHash: string; phone: string | null; address: string | null },
): Promise<void> {
  await db.orm.public.User.where({ id: userId }).update({
    passwordHash: data.passwordHash,
    phone: data.phone,
    address: data.address,
    needsOnboarding: false,
  });
}

export async function touchLastSeen(userId: number): Promise<void> {
  await db.orm.public.User.where({ id: userId }).update({
    lastSeenAt: new Date().toISOString(),
  });
}
