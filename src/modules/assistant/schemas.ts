import { z } from "zod";

const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const chatSchema = z.object({
  history: z.array(chatTurnSchema).default([]),
  message: z.string().min(1, "message is required"),
});

const breakMinutes = z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]);

const confirmShiftSchema = z.object({
  userId: z.number().int().positive(),
  startsAt: z.string().min(1, "startsAt is required"),
  endsAt: z.string().min(1, "endsAt is required"),
  breakMinutes: breakMinutes.optional(),
});

export const confirmSchema = z.object({
  shifts: z.array(confirmShiftSchema).min(1, "at least one shift is required"),
});
