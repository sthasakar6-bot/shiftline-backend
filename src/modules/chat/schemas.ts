import { z } from "zod";

export const postMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  replyToId: z.number().int().positive().nullable().optional(),
});
