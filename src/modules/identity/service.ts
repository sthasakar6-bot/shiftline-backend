import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import {
  findUserByEmailInCompany,
  findUserById,
  createUser,
  setUserPassword,
  setUserPhone,
} from "./model";
import { validateInviteToken, consumeInvite } from "../invite/service";
import { findCompanyById } from "../company/model";

export async function register(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  token: string,
  phone?: string,
  address?: string,
) {
  const invite = await validateInviteToken(token);
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    throw new AppError(400, "This invite was issued for a different email address");
  }

  const existing = await findUserByEmailInCompany(email, invite.companyId);
  if (existing) {
    throw new AppError(400, "Email already registered");
  }

  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const passwordHash = await argon2.hash(password);
  const user = await createUser({
    name: `${trimmedFirst} ${trimmedLast}`.trim(),
    firstName: trimmedFirst,
    lastName: trimmedLast,
    email,
    passwordHash,
    role: "employee",
    managerId: invite.managerId,
    companyId: invite.companyId,
    phone: phone?.trim() || undefined,
    address: address?.trim() || undefined,
  });

  await consumeInvite(invite.id);

  const company = await findCompanyById(user.companyId);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: company?.name ?? "",
    companySlug: company?.slug ?? "",
  };
}

export async function login(email: string, password: string, companyId: number) {
  const user = await findUserByEmailInCompany(email, companyId);
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, companyId: user.companyId },
    env.jwtSecret,
    { expiresIn: "7d" },
  );

  const company = await findCompanyById(user.companyId);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hasAvatar: Boolean(user.avatarBase64),
      phone: user.phone,
      address: user.address,
      companyId: user.companyId,
      companyName: company?.name ?? "",
      companySlug: company?.slug ?? "",
    },
  };
}

export async function getCurrentUser(userId: number) {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  const company = await findCompanyById(user.companyId);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    hasAvatar: Boolean(user.avatarBase64),
    phone: user.phone,
    address: user.address,
    companyId: user.companyId,
    companyName: company?.name ?? "",
    companySlug: company?.slug ?? "",
  };
}

export async function updatePhone(userId: number, phone: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  await setUserPhone(userId, phone.trim() || null);
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
