import { Request, Response } from "express";
import { chat, confirmShifts } from "./service";

export async function chatController(req: Request, res: Response) {
  const { history, message } = req.body;
  const result = await chat(req.user!.companyId, req.user!.sub, history, message);
  res.json(result);
}

export async function confirmController(req: Request, res: Response) {
  const { shifts } = req.body;
  const results = await confirmShifts(req.user!.companyId, req.user!.sub, shifts);
  res.json({ results });
}
