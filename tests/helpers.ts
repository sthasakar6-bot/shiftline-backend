import request from "supertest";
import crypto from "crypto";
import argon2 from "argon2";
import app from "../src/app";
import { db } from "../src/prisma/db";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

// Registration now requires a valid invite from an existing manager. With no
// managerId, there's no manager yet to issue one -- this mirrors the
// out-of-band bootstrap a real deployment's first manager account needs (see
// scripts/make-manager.ts), so we create the row directly. With a managerId,
// we seed the invite that manager would have sent and register through the
// real /auth/register endpoint, exercising the actual invite-consumption path.
export async function registerUser(
  overrides: { name?: string; email?: string; password?: string; managerId?: number } = {},
) {
  const email = overrides.email ?? uniqueEmail("user");
  const password = overrides.password ?? "password123";
  const name = overrides.name ?? "Test User";

  if (overrides.managerId === undefined) {
    const passwordHash = await argon2.hash(password);
    const user = await db.orm.public.User.create({
      name,
      email,
      passwordHash,
      role: "employee",
    });
    return { ...user, email, password };
  }

  const token = crypto.randomBytes(16).toString("hex");
  await db.orm.public.Invite.create({
    email,
    token,
    managerId: overrides.managerId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  const res = await request(app).post("/api/auth/register").send({ name, email, password, token });
  return { ...res.body, email, password };
}

export async function loginUser(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token as string;
}

export async function registerAndLogin(
  overrides: Parameters<typeof registerUser>[0] = {},
) {
  const user = await registerUser(overrides);
  const token = await loginUser(user.email, user.password);
  return { user, token };
}
