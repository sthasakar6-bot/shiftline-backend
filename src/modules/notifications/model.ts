import { db } from "../../prisma/db";

export interface Notification {
  id: number;
  userId: number;
  message: string;
  url: string | null;
  read: boolean;
  relatedShiftId: number | null;
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

export async function createNotification(
  userId: number,
  message: string,
  url?: string,
  relatedShiftId?: number,
): Promise<Notification> {
  return db.orm.public.Notification.create({ userId, message, url, relatedShiftId });
}

// Clears every notification (employee's and manager's copies alike) tied to
// a shift -- used to auto-dismiss a "missed clock-in/out" alert once the
// employee actually clocks in/out, even if nobody ever opened it.
export async function deleteNotificationsForShift(shiftId: number): Promise<void> {
  const matches = await db.orm.public.Notification.select("id").where({ relatedShiftId: shiftId }).all();
  await Promise.all(matches.map((n) => db.orm.public.Notification.where({ id: n.id }).delete()));
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
