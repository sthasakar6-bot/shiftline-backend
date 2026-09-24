import { Request, Response } from "express";
import { signup, startPurchase, completeSignup } from "./service";
import { findPendingSignupByEmail } from "./pendingSignupModel";
import { AppError } from "../../errors/AppError";

export async function signupController(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "A company logo is required");
  }
  const { companyName, firstName, lastName, email, password } = req.body;
  const result = await signup({
    companyName,
    firstName,
    lastName,
    email,
    password,
    logoBuffer: req.file.buffer,
    logoMimeType: req.file.mimetype,
  });
  res.status(201).json(result);
}

export async function purchaseCheckoutController(req: Request, res: Response) {
  const { email, plan, interval } = req.body;
  const result = await startPurchase(email, plan, interval);
  res.json(result);
}

// Public, read-only -- lets CompleteSignupPage check whether a payment has
// actually cleared before showing the company-creation form, instead of
// only finding out after a failed submit. Only exposes the boolean the
// frontend needs, never the Mollie customer id or anything else on the row.
export async function purchasePendingStatusController(req: Request, res: Response) {
  const email = String(req.query.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new AppError(400, "email is required");
  }
  const pending = await findPendingSignupByEmail(email);
  res.json({ paid: pending?.paid ?? false, exists: pending !== null });
}

export async function completeSignupController(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "A company logo is required");
  }
  const { email, companyName, firstName, lastName, password } = req.body;
  const result = await completeSignup({
    email,
    companyName,
    firstName,
    lastName,
    password,
    logoBuffer: req.file.buffer,
    logoMimeType: req.file.mimetype,
  });
  res.status(201).json(result);
}
