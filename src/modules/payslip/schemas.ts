import { z } from "zod";

export const createPayslipSchema = z.object({
  period: z.string().min(1, "period is required"),
});
