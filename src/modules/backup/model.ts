import { db } from "../../prisma/db";

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
