import { Request, Response } from "express";
import { createInvite, listInvites, validateInviteToken } from "./service";

export const createInviteController = async (req: Request, res: Response) => {
  const invite = await createInvite(req.user!.sub, req.body.email);
  res.status(201).json(invite);
};

export const listInvitesController = async (req: Request, res: Response) => {
  const invites = await listInvites(req.user!.sub);
  res.json(invites);
};

export const getInviteByTokenController = async (req: Request, res: Response) => {
  const invite = await validateInviteToken(String(req.params.token));
  res.json({ email: invite.email });
};
