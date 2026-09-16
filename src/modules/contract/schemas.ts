import { z } from "zod";

export const createContractSchema = z.object({
  role: z.string().min(1, "role is required"),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export const updateContractSchema = z.object({
  role: z.string().min(1).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});
