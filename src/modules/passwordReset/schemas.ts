import { z } from "zod";

export const requestResetSchema = z.object({
  email: z.string().email("invalid email"),
  companyId: z.coerce.number().int().positive("companyId must be a positive integer"),
});

export const completeResetSchema = z.object({
  password: z.string().min(8, "password must be at least 8 characters"),
});
