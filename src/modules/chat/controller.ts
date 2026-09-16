import { Request, Response } from "express";
import { getHistory, postMessage, deleteMessage } from "./service";

export async function listMessagesController(req: Request, res: Response) {
  const messages = await getHistory(req.user!.companyId);
  res.json(messages);
}

export async function createMessageController(req: Request, res: Response) {
  const { body, replyToId } = req.body;
  const message = await postMessage(req.user!.companyId, req.user!.sub, body, replyToId ?? null);
  res.status(201).json(message);
}

export async function deleteMessageController(req: Request, res: Response) {
  await deleteMessage(req.user!.companyId, req.user!.sub, Number(req.params.id));
  res.status(204).send();
}
