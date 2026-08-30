import { Request, Response } from "express";
import {
  requestReset,
  listPendingRequestsForManager,
  validateResetToken,
  completeReset,
} from "./service";

export async function requestResetController(req: Request, res: Response) {
  const { email } = req.body;
  await requestReset(email);
  res.status(201).json({ ok: true });
}

export async function listPendingRequestsController(req: Request, res: Response) {
  const requests = await listPendingRequestsForManager(req.user!.sub);
  res.json(requests);
}

export async function getResetTokenController(req: Request, res: Response) {
  const { email } = await validateResetToken(String(req.params.token));
  res.json({ email });
}

export async function completeResetController(req: Request, res: Response) {
  const { password } = req.body;
  await completeReset(String(req.params.token), password);
  res.status(204).send();
}
