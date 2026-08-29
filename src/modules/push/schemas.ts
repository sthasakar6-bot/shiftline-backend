import { z } from "zod";

export const subscribeSchema = z.object({
  endpoint: z.string().min(1, "endpoint is required"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh is required"),
    auth: z.string().min(1, "auth is required"),
  }),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().min(1, "endpoint is required"),
});
