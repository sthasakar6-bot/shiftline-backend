import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { findUserByEmail, findUserById, createUser } from "./model";

export async function register(name: string, email: string, password: string, managerId?: number) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError(400, "Email already registered");
  }

  if (managerId !== undefined) {
    const manager = await findUserById(managerId);
    if (!manager || manager.role !== "manager") {
      throw new AppError(400, "managerId must reference an existing manager");
    }
  }

  const passwordHash = await argon2.hash(password);
  const user = await createUser({ name, email, passwordHash, role: "employee", managerId });

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function login(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.jwtSecret, {
    expiresIn: "7d",
  });

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export async function getCurrentUser(userId: number) {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
