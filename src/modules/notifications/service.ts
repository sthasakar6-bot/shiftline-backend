import {
  findNotificationsByUser,
  findNotificationByIdForUser,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotificationForUser,
} from "./model";
import { AppError } from "../../errors/AppError";
import { sendPushToUser } from "../../lib/webPush";

export async function listNotifications(userId: number) {
  return findNotificationsByUser(userId);
}

export async function notify(userId: number, message: string, title = "Notification", url = "/") {
  const notification = await createNotification(userId, message);
  await sendPushToUser(userId, { title, body: message, url });
  return notification;
}

export async function markAsRead(id: number, userId: number) {
  const updated = await markNotificationRead(id, userId);
  if (!updated) {
    throw new AppError(404, "Notification not found");
  }
  return updated;
}

export async function markAllAsRead(userId: number) {
  await markAllNotificationsRead(userId);
}

export async function removeNotification(id: number, userId: number) {
  const existing = await findNotificationByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Notification not found");
  }
  await deleteNotificationForUser(id, userId);
}
