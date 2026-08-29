import { findNotificationsByUser, createNotification, markNotificationRead } from "./model";
import { AppError } from "../../errors/AppError";
import { sendPushToUser } from "../../lib/webPush";

export async function listNotifications(userId: number) {
  return findNotificationsByUser(userId);
}

export async function notify(userId: number, message: string) {
  const notification = await createNotification(userId, message);
  await sendPushToUser(userId, { title: "Shiftline", body: message });
  return notification;
}

export async function markAsRead(id: number, userId: number) {
  const updated = await markNotificationRead(id, userId);
  if (!updated) {
    throw new AppError(404, "Notification not found");
  }
  return updated;
}
