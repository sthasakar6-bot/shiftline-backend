import request from "supertest";
import app from "../src/app";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

export async function registerUser(
  overrides: { name?: string; email?: string; password?: string; managerId?: number } = {},
) {
  const email = overrides.email ?? uniqueEmail("user");
  const password = overrides.password ?? "password123";
  const name = overrides.name ?? "Test User";
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name, email, password, managerId: overrides.managerId });
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
