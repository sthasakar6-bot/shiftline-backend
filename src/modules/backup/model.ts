import { db } from "../../prisma/db";

export interface BackupToken {
  id: number;
  userId: number;
  token: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function findBackupTokenByUser(userId: number): Promise<BackupToken | null> {
  return db.orm.public.BackupToken.where({ userId }).first();
}

export async function findUserIdByBackupToken(token: string): Promise<number | null> {
  const found = await db.orm.public.BackupToken.select("userId").where({ token }).first();
  return found?.userId ?? null;
}

export async function createBackupToken(userId: number, token: string): Promise<BackupToken> {
  // One active token per manager -- generating a new one replaces the old.
  await db.orm.public.BackupToken.where({ userId }).delete();
  return db.orm.public.BackupToken.create({ userId, token });
}

export async function deleteBackupTokenForUser(userId: number): Promise<void> {
  await db.orm.public.BackupToken.where({ userId }).delete();
}

export async function touchBackupTokenUsage(token: string): Promise<void> {
  await db.orm.public.BackupToken.where({ token }).update({
    lastUsedAt: new Date().toISOString(),
  });
}
