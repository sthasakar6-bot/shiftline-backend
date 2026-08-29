import { z } from "zod";

export const createContractSchema = z.object({
  role: z.string().min(1, "role is required"),
});

export const updateContractSchema = z.object({
  role: z.string().min(1).optional(),
});
