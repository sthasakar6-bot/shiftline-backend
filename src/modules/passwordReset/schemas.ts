import { z } from "zod";

export const requestResetSchema = z.object({
  email: z.string().email("invalid email"),
});

export const completeResetSchema = z.object({
  password: z.string().min(8, "password must be at least 8 characters"),
});
