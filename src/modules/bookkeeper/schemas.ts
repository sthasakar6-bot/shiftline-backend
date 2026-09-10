import { z } from "zod";

export const createContractSchema = z.object({
  role: z.string().min(1, "role is required"),
});

export const createPayslipSchema = z.object({
  period: z.string().min(1, "period is required"),
});
