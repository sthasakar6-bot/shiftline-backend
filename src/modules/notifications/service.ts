import {
  findNotificationsByUser,
  findNotificationByIdForUser,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotificationForUser,
  deleteNotificationsForShift,
} from "./model";
import { AppError } from "../../errors/AppError";
import { sendPushToUser } from "../../lib/webPush";

export async function listNotifications(userId: number) {
  return findNotificationsByUser(userId);
}

export async function notify(
  userId: number,
  message: string,
  title = "Notification",
  url = "/",
  relatedShiftId?: number,
) {
  const notification = await createNotification(userId, message, url, relatedShiftId);
  await sendPushToUser(userId, { title, body: message, url });
  return notification;
}

// See deleteNotificationsForShift in the model -- clears both the
// employee's and their manager's missed-clock-in/out alerts for a shift
// once it no longer applies.
export async function clearShiftNotifications(shiftId: number) {
  await deleteNotificationsForShift(shiftId);
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
