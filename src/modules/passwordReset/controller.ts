import { Request, Response } from "express";
import {
  requestReset,
  listPendingRequestsForManager,
  validateResetToken,
  completeReset,
  resolveResetRequest,
} from "./service";

export async function requestResetController(req: Request, res: Response) {
  const { email, companyId } = req.body;
  await requestReset(email, Number(companyId));
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

export async function resolveResetRequestController(req: Request, res: Response) {
  const { password } = req.body;
  await resolveResetRequest(req.user!.sub, Number(req.params.id), password);
  res.status(204).send();
}
