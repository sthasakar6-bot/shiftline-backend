import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { findUserByEmail, findUserById, createUser, setUserPassword } from "./model";
import { validateInviteToken, consumeInvite } from "../invite/service";

export async function register(name: string, email: string, password: string, token: string) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError(400, "Email already registered");
  }

  const invite = await validateInviteToken(token);
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    throw new AppError(400, "This invite was issued for a different email address");
  }

  const passwordHash = await argon2.hash(password);
  const user = await createUser({
    name,
    email,
    passwordHash,
    role: "employee",
    managerId: invite.managerId,
  });

  await consumeInvite(invite.id);

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
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hasAvatar: Boolean(user.avatarBase64),
    },
  };
}

export async function getCurrentUser(userId: number) {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    hasAvatar: Boolean(user.avatarBase64),
  };
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
) {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  const valid = await argon2.verify(user.passwordHash, currentPassword);
  if (!valid) {
    throw new AppError(401, "Current password is incorrect");
  }
  const passwordHash = await argon2.hash(newPassword);
  await setUserPassword(userId, passwordHash);
}
