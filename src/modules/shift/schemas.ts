import { z } from "zod";

const breakMinutes = z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]);

export const createShiftSchema = z.object({
  startsAt: z.string().min(1, "startsAt is required"),
  endsAt: z.string().min(1, "endsAt is required"),
  breakMinutes: breakMinutes.optional(),
});

export const updateShiftSchema = z.object({
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  breakMinutes: breakMinutes.optional(),
});
