import { z } from "zod";

export const checkoutSchema = z.object({
  plan: z.enum(["starter", "unlimited"]),
  interval: z.enum(["monthly", "yearly"]),
  provider: z.enum(["mollie", "stripe"]),
});

export const addonCheckoutSchema = z.object({
  provider: z.enum(["mollie", "stripe"]),
});
