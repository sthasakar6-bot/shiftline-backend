import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "color must be a hex code like #4f46e5");

export const createShiftTypeSchema = z.object({
  name: z.string().min(1, "name is required").max(60, "name must be at most 60 characters"),
  color: hexColor,
  order: z.number().int().optional(),
});

export const updateShiftTypeSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: hexColor.optional(),
  order: z.number().int().optional(),
});
