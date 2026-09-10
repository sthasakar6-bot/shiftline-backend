import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import {
  findUserByEmailInCompany,
  findUserById,
  setUserPassword,
  setUserPhone,
  markOnboardingComplete,
} from "./model";
import { findCompanyById } from "../company/model";

export async function login(email: string, password: string, companyId: number) {
  const user = await findUserByEmailInCompany(email, companyId);
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  if (!user.active) {
    throw new AppError(403, "This account has been deactivated. Contact your manager.");
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
      location: user.location,
      needsOnboarding: user.needsOnboarding,
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
    location: user.location,
    needsOnboarding: user.needsOnboarding,
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

// The one-time step a manager-created employee goes through on first login:
// they arrive with a temporary password the manager chose for them, so this
// replaces it with one only they know and lets them fill in contact details
// the manager may not have collected up front.
export async function completeOnboarding(
  userId: number,
  newPassword: string,
  phone?: string,
  address?: string,
) {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  if (!user.avatarBase64) {
    throw new AppError(400, "A profile picture is required before you can continue");
  }
  const passwordHash = await argon2.hash(newPassword);
  await markOnboardingComplete(userId, {
    passwordHash,
    phone: phone?.trim() || null,
    address: address?.trim() || null,
  });
}
