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
