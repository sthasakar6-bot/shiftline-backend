import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { db } from "../../prisma/db";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";

const TRIAL_DAYS = 15;
const MAX_SLUG_ATTEMPTS = 20;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "company";
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
  const passwordHash = await argon2.hash(input.password);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const baseSlug = slugify(input.companyName);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  // Normalized so "Test@X.com" can't dodge the reuse check below by casing
  // alone -- User.email isn't globally unique in the schema (it's scoped
  // per-company, to support the manager-created-employee flow), so this is
  // an application-level check, not a DB constraint.
  const email = input.email.trim().toLowerCase();

  const { company, user } = await db.transaction(async (tx) => {
    // An email that's already signed up for a trial before (in any company,
    // regardless of that company's current plan/trial status) can't start
    // a fresh trial under a new company name -- closes the "trial expired,
    // just sign up again" loophole. A genuinely new customer with a new
    // email is unaffected.
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
      plan: "trial",
      trialEndsAt: trialEndsAt.toISOString(),
      logoBase64: input.logoBuffer.toString("base64"),
      logoMimeType: input.logoMimeType,
    });

    // The signup form sets a real password directly, unlike a manager-created
    // employee who gets a temporary one from someone else -- so this account
    // skips needsOnboarding entirely rather than bouncing a brand-new trial
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
