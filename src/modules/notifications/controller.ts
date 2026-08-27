import { Request, Response } from "express";
import { listNotifications, markAsRead } from "./service";

export async function listNotificationsController(req: Request, res: Response) {
  const notifications = await listNotifications(req.user!.sub);
  res.json(notifications);
}

export async function markReadController(req: Request, res: Response) {
  const notification = await markAsRead(Number(req.params.id), req.user!.sub);
  res.json(notification);
}
