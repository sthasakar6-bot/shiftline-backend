import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().min(1, "firstName is required"),
  lastName: z.string().min(1, "lastName is required"),
  email: z.string().email("invalid email"),
  password: z.string().min(8, "password must be at least 8 characters"),
  token: z.string().min(1, "an invite token is required to register"),
  phone: z.string().max(30, "phone must be at most 30 characters").optional(),
  address: z.string().max(200, "address must be at most 200 characters").optional(),
});

export const loginSchema = z.object({
  email: z.string().email("invalid email"),
  password: z.string().min(1, "password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword: z.string().min(8, "newPassword must be at least 8 characters"),
});

export const updatePhoneSchema = z.object({
  phone: z.string().max(30, "phone must be at most 30 characters"),
});
