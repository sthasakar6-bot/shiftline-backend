import { z } from "zod";

export const signupSchema = z.object({
  companyName: z.string().min(2, "companyName must be at least 2 characters").max(100),
  firstName: z.string().min(1, "firstName is required").max(60),
  lastName: z.string().min(1, "lastName is required").max(60),
  email: z.string().email("invalid email"),
  password: z.string().min(8, "password must be at least 8 characters"),
});
