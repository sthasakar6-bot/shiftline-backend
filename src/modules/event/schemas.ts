import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(1, "title is required").max(120, "title must be at most 120 characters"),
  startsAt: z.string().min(1, "startsAt is required"),
  endsAt: z.string().nullable().optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().nullable().optional(),
});
