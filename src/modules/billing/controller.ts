import { Request, Response } from "express";
import { initiateCheckout, initiateAddonCheckout, getBillingStatus, handleWebhook } from "./service";

export async function checkoutController(req: Request, res: Response) {
  const { plan, interval } = req.body;
  const result = await initiateCheckout(req.user!.companyId, req.user!.sub, plan, interval);
  res.json(result);
}

export async function addonCheckoutController(req: Request, res: Response) {
  const result = await initiateAddonCheckout(req.user!.companyId, req.user!.sub);
  res.json(result);
}

export async function statusController(req: Request, res: Response) {
  const status = await getBillingStatus(req.user!.companyId);
  res.json(status);
}

export async function mollieWebhookController(req: Request, res: Response) {
  await handleWebhook(req.body as Buffer, req.headers);
  res.status(200).send();
}
