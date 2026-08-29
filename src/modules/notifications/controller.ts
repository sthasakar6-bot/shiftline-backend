import { Request, Response } from "express";
import { listNotifications, markAsRead, markAllAsRead, removeNotification } from "./service";

export async function listNotificationsController(req: Request, res: Response) {
  const notifications = await listNotifications(req.user!.sub);
  res.json(notifications);
}

export async function markReadController(req: Request, res: Response) {
  const notification = await markAsRead(Number(req.params.id), req.user!.sub);
  res.json(notification);
}

export async function markAllReadController(req: Request, res: Response) {
  await markAllAsRead(req.user!.sub);
  res.status(204).send();
}

export async function deleteNotificationController(req: Request, res: Response) {
  await removeNotification(Number(req.params.id), req.user!.sub);
  res.status(204).send();
}
