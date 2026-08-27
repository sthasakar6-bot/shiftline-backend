import { z } from "zod";

export const createContractSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().optional(),
  status: z.string().optional(),
});

export const updateContractSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
});
