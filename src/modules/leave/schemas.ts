import { z } from "zod";

export const createLeaveRequestSchema = z.object({
  type: z.enum(["vacation", "sick"]),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  reason: z.string().optional(),
});

export const decideLeaveRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});
