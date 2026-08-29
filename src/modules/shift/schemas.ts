import { z } from "zod";

export const createShiftSchema = z.object({
  startsAt: z.string().min(1, "startsAt is required"),
  endsAt: z.string().min(1, "endsAt is required"),
  breakStart: z.string().optional(),
  breakEnd: z.string().optional(),
});

export const updateShiftSchema = z.object({
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  breakStart: z.string().optional(),
  breakEnd: z.string().optional(),
});
