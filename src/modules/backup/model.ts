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

export interface BackupSnapshotMeta {
  id: number;
  userId: number;
  createdAt: string;
}

export interface BackupSnapshot extends BackupSnapshotMeta {
  csv: string;
}

export async function findAllManagerIds(): Promise<number[]> {
  const managers = await db.orm.public.User.select("id").where({ role: "manager" }).all();
  return managers.map((m) => m.id);
}

export async function createBackupSnapshot(userId: number, csv: string): Promise<void> {
  await db.orm.public.BackupSnapshot.create({ userId, csv });
}

export async function findBackupSnapshotsByUser(userId: number): Promise<BackupSnapshotMeta[]> {
  return db.orm.public.BackupSnapshot.select("id", "userId", "createdAt")
    .where({ userId })
    .orderBy((s) => s.createdAt.desc())
    .all();
}

export async function findBackupSnapshotByIdForUser(
  id: number,
  userId: number,
): Promise<BackupSnapshot | null> {
  return db.orm.public.BackupSnapshot.where({ id, userId }).first();
}

export async function deleteBackupSnapshotsOlderThan(cutoff: string): Promise<void> {
  // .delete() on a multi-row predicate only touches the first matching row,
  // so fetch the stale ids first and delete each one.
  const stale = await db.orm.public.BackupSnapshot.select("id")
    .where((s) => s.createdAt.lt(cutoff))
    .all();
  await Promise.all(stale.map((s) => db.orm.public.BackupSnapshot.where({ id: s.id }).delete()));
}
