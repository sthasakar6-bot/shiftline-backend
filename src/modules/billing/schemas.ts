import { z } from "zod";

export const checkoutSchema = z.object({
  plan: z.enum(["starter", "unlimited"]),
  interval: z.enum(["monthly", "yearly"]),
});
