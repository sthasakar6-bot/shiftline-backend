import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { db } from "../../prisma/db";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { initiateCheckout } from "../billing/service";
import { createPresignupCheckoutSession } from "../billing/providers/mollie";
import type { PlanKey, BillingInterval } from "../billing/providers/types";
import {
  findPendingSignupByEmail,
  upsertPendingSignup,
  deletePendingSignup,
} from "./pendingSignupModel";

const TRIAL_DAYS = 15;
const MAX_SLUG_ATTEMPTS = 20;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "company";
}

interface NewCompanyBilling {
  plan: string;
  trialEndsAt: string | null;
  billingProvider: string | null;
  billingCustomerId: string | null;
  billingSubscriptionId: string | null;
  billingInterval: string | null;
  subscriptionStatus: string | null;
}

// Shared by signup() (free trial, no billing fields) and completeSignup()
// (already paid -- plan/billing fields carried over from the PendingSignup
// row) -- everything else about creating the company + its first manager
// account is identical between the two.
export async function createCompanyAndManager(
  input: {
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    logoBuffer: Buffer;
    logoMimeType: string;
  },
  billing: NewCompanyBilling,
) {
  const passwordHash = await argon2.hash(input.password);
  const baseSlug = slugify(input.companyName);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  // Normalized so "Test@X.com" can't dodge the reuse check below by casing
  // alone -- User.email isn't globally unique in the schema (it's scoped
  // per-company, to support the manager-created-employee flow), so this is
  // an application-level check, not a DB constraint.
  const email = input.email.trim().toLowerCase();

  const { company, user } = await db.transaction(async (tx) => {
    // An email that's already signed up before (in any company, regardless
    // of that company's current plan/trial status) can't create a second
    // one -- closes the "trial expired, just sign up again" loophole. A
    // genuinely new customer with a new email is unaffected.
    const existingUser = await tx.orm.public.User.where({ email }).first();
    if (existingUser) {
      throw new AppError(
        400,
        "An account with this email already exists. Log in instead, or contact us if you need a new company set up.",
      );
    }

    // Resolve a free slug inside the transaction so two concurrent signups
    // for the same company name can't both pick the same candidate -- the
    // slug @unique constraint is the final backstop regardless.
    let slug = baseSlug;
    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const existing = await tx.orm.public.Company.where({ slug }).first();
      if (!existing) break;
      slug = `${baseSlug}-${attempt + 1}`;
      if (attempt === MAX_SLUG_ATTEMPTS) {
        slug = `${baseSlug}-${Date.now().toString(36)}`;
      }
    }

    const company = await tx.orm.public.Company.create({
      name: input.companyName,
      slug,
      logoBase64: input.logoBuffer.toString("base64"),
      logoMimeType: input.logoMimeType,
      ...billing,
    });

    // The signup form sets a real password directly, unlike a manager-created
    // employee who gets a temporary one from someone else -- so this account
    // skips needsOnboarding entirely rather than bouncing a brand-new
    // signup into the mandatory-profile-photo wall.
    const user = await tx.orm.public.User.create({
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email,
      passwordHash,
      role: "manager",
      companyId: company.id,
      needsOnboarding: false,
    });

    return { company, user };
  });

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, companyId: user.companyId },
    env.jwtSecret,
    { expiresIn: "7d" },
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hasAvatar: false,
      phone: null,
      address: null,
      location: null,
      needsOnboarding: false,
      companyId: user.companyId,
      companyName: company.name,
      companySlug: company.slug,
    },
  };
}

export async function signup(input: {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  logoBuffer: Buffer;
  logoMimeType: string;
}) {
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return createCompanyAndManager(input, {
    plan: "trial",
    trialEndsAt: trialEndsAt.toISOString(),
    billingProvider: null,
    billingCustomerId: null,
    billingSubscriptionId: null,
    billingInterval: null,
    subscriptionStatus: null,
  });
}

// Reached from the marketing site's "Get Starter"/"Get Unlimited" buttons
// (via PurchasePage.tsx) -- pays *before* any company/account exists (for a
// brand-new customer) or reuses an existing company's checkout entirely
// (for a returning customer, e.g. one whose trial expired and is now
// locked out). Which branch runs is decided purely by whether the email
// already has an account -- the caller doesn't need to know or say which.
export async function startPurchase(
  email: string,
  plan: PlanKey,
  interval: BillingInterval,
): Promise<{ redirectUrl: string }> {
  const normalized = email.trim().toLowerCase();
  const existingUser = await db.orm.public.User.where({ email: normalized }).first();

  if (existingUser) {
    // Full reuse -- initiateCheckout already does everything needed once a
    // companyId/userId pair is known. Any user's email at the company
    // (manager or employee) is accepted: the whole company is locked out
    // equally by an expired trial, and paying only ever unlocks/upgrades
    // access, never anything destructive.
    return initiateCheckout(existingUser.companyId, existingUser.id, plan, interval);
  }

  const pending = await findPendingSignupByEmail(normalized);
  const existingCustomerId = pending?.billingCustomerId ?? null;
  const { redirectUrl, providerCustomerId } = await createPresignupCheckoutSession({
    email: normalized,
    plan,
    interval,
    existingCustomerId,
  });
  await upsertPendingSignup(normalized, plan, interval, providerCustomerId);
  return { redirectUrl };
}

// Reached from CompleteSignupPage.tsx after a presignup payment succeeds --
// the mirror image of signup() for a customer who already paid instead of
// starting a free trial.
export async function completeSignup(input: {
  email: string;
  companyName: string;
  firstName: string;
  lastName: string;
  password: string;
  logoBuffer: Buffer;
  logoMimeType: string;
}) {
  const normalized = input.email.trim().toLowerCase();
  const pending = await findPendingSignupByEmail(normalized);
  if (!pending || !pending.paid) {
    throw new AppError(
      402,
      "We're still confirming your payment. Please wait a moment and try again.",
      "PAYMENT_NOT_CONFIRMED",
    );
  }

  const result = await createCompanyAndManager(
    { ...input, email: normalized },
    {
      plan: pending.plan,
      trialEndsAt: null,
      billingProvider: "mollie",
      billingCustomerId: pending.billingCustomerId,
      billingSubscriptionId: pending.billingSubscriptionId,
      billingInterval: pending.interval,
      subscriptionStatus: "active",
    },
  );

  await deletePendingSignup(normalized);
  return result;
}
