import { z } from "zod";

const breakMinutes = z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]);

export const createOpenShiftSchema = z.object({
  departmentId: z.number().int().positive().optional(),
  shiftTypeId: z.number().int().positive().optional(),
  startsAt: z.string().min(1, "startsAt is required"),
  endsAt: z.string().min(1, "endsAt is required"),
  breakMinutes: breakMinutes.optional(),
  requiredCount: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(200, "notes must be at most 200 characters").optional(),
});

export const updateOpenShiftSchema = z.object({
  departmentId: z.number().int().positive().nullable().optional(),
  shiftTypeId: z.number().int().positive().nullable().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  breakMinutes: breakMinutes.optional(),
  requiredCount: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(200).nullable().optional(),
});

export const assignOpenShiftSchema = z.object({
  userId: z.number().int().positive(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  breakMinutes: breakMinutes.optional(),
});
