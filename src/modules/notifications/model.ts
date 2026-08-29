import { db } from "../../prisma/db";

export interface Notification {
  id: number;
  userId: number;
  message: string;
  read: boolean;
  createdAt: string;
}

export async function findNotificationsByUser(userId: number): Promise<Notification[]> {
  return db.orm.public.Notification.where({ userId }).orderBy((n) => n.createdAt.desc()).all();
}

export async function findNotificationByIdForUser(
  id: number,
  userId: number,
): Promise<Notification | null> {
  return db.orm.public.Notification.where({ id, userId }).first();
}

export async function createNotification(userId: number, message: string): Promise<Notification> {
  return db.orm.public.Notification.create({ userId, message });
}

export async function markNotificationRead(
  id: number,
  userId: number,
): Promise<Notification | null> {
  return db.orm.public.Notification.where({ id, userId }).update({ read: true });
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  // .update() only ever touches the first row a predicate matches, even when
  // the predicate matches several -- fetch the unread ids and update each.
  const unread = await db.orm.public.Notification.select("id")
    .where({ userId, read: false })
    .all();
  await Promise.all(
    unread.map((n) => db.orm.public.Notification.where({ id: n.id, userId }).update({ read: true })),
  );
}

export async function deleteNotificationForUser(id: number, userId: number): Promise<void> {
  await db.orm.public.Notification.where({ id, userId }).delete();
}
