import { Request, Response } from "express";
import { subscribe, unsubscribe } from "./service";

export async function subscribeController(req: Request, res: Response) {
  const { endpoint, keys } = req.body;
  const sub = await subscribe(req.user!.sub, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
  res.status(201).json(sub);
}

export async function unsubscribeController(req: Request, res: Response) {
  const { endpoint } = req.body;
  await unsubscribe(endpoint);
  res.status(204).send();
}
