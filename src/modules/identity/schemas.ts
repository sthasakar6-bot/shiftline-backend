import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("invalid email"),
  password: z.string().min(1, "password is required"),
  companyId: z.coerce.number().int().positive("companyId must be a positive integer"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword: z.string().min(8, "newPassword must be at least 8 characters"),
});

export const updatePhoneSchema = z.object({
  phone: z.string().max(30, "phone must be at most 30 characters"),
});
