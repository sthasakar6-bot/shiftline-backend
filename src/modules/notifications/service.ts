import { findNotificationsByUser, createNotification, markNotificationRead } from "./model";
import { AppError } from "../../errors/AppError";

export async function listNotifications(userId: number) {
  return findNotificationsByUser(userId);
}

export async function notify(userId: number, message: string) {
  return createNotification(userId, message);
}

export async function markAsRead(id: number, userId: number) {
  const updated = await markNotificationRead(id, userId);
  if (!updated) {
    throw new AppError(404, "Notification not found");
  }
  return updated;
}
