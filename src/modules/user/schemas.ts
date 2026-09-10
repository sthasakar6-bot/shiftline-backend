import { z } from "zod";

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "firstName is required"),
  lastName: z.string().min(1, "lastName is required"),
  email: z.string().email("invalid email"),
  password: z.string().min(8, "password must be at least 8 characters"),
});

export const setLocationSchema = z.object({
  location: z.string().max(100, "location must be at most 100 characters").nullable(),
});
