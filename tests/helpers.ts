import request from "supertest";
import crypto from "crypto";
import argon2 from "argon2";
import app from "../src/app";
import { db } from "../src/prisma/db";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

let defaultTestCompanyId: number | null = null;

// Most tests don't care about multi-company isolation and just need *a*
// company to satisfy the required companyId FK -- this lazily creates one
// shared default and reuses it for the rest of the test run. Tests that
// specifically exercise cross-company behavior create their own company
// instead and pass its id via overrides.companyId.
export async function getDefaultTestCompanyId(): Promise<number> {
  if (defaultTestCompanyId !== null) return defaultTestCompanyId;
  const company = await db.orm.public.Company.create({
    name: "Test Co",
    slug: `test-co-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  });
  defaultTestCompanyId = company.id;
  return company.id;
}

export async function createCompany(name: string): Promise<number> {
  const company = await db.orm.public.Company.create({
    name,
    slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  });
  return company.id;
}

// Registration now requires a valid invite from an existing manager. With no
// managerId, there's no manager yet to issue one -- this mirrors the
// out-of-band bootstrap a real deployment's first manager account needs (see
// scripts/make-manager.ts), so we create the row directly. With a managerId,
// we seed the invite that manager would have sent and register through the
// real /auth/register endpoint, exercising the actual invite-consumption path.
export async function registerUser(
  overrides: {
    name?: string;
    email?: string;
    password?: string;
    managerId?: number;
    companyId?: number;
  } = {},
) {
  const email = overrides.email ?? uniqueEmail("user");
  const password = overrides.password ?? "password123";
  const name = overrides.name ?? "Test User";
  const spaceIdx = name.indexOf(" ");
  const firstName = spaceIdx === -1 ? name : name.slice(0, spaceIdx);
  const lastName = spaceIdx === -1 ? "User" : name.slice(spaceIdx + 1);

  if (overrides.managerId === undefined) {
    const companyId = overrides.companyId ?? (await getDefaultTestCompanyId());
    const passwordHash = await argon2.hash(password);
    const user = await db.orm.public.User.create({
      name,
      firstName,
      lastName,
      email,
      passwordHash,
      role: "employee",
      companyId,
    });
    return { ...user, email, password };
  }

  // Real invites are always scoped to the inviting manager's own company --
  // mirror that instead of trusting a separately-passed companyId.
  const manager = await db.orm.public.User.where({ id: overrides.managerId }).first();
  const token = crypto.randomBytes(16).toString("hex");
  await db.orm.public.Invite.create({
    email,
    token,
    managerId: overrides.managerId,
    companyId: manager!.companyId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  const res = await request(app)
    .post("/api/auth/register")
    .send({ firstName, lastName, email, password, token });
  return { ...res.body, email, password };
}

export async function loginUser(
  email: string,
  password: string,
  companyId?: number,
): Promise<string> {
  const resolvedCompanyId = companyId ?? (await getDefaultTestCompanyId());
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password, companyId: resolvedCompanyId });
  return res.body.token as string;
}

export async function registerAndLogin(
  overrides: Parameters<typeof registerUser>[0] = {},
) {
  const user = await registerUser(overrides);
  const token = await loginUser(user.email, user.password, user.companyId);
  return { user, token };
}
