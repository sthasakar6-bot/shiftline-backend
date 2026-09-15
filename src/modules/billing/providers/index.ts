import { mollieAdapter } from "./mollie";
import { stripeAdapter } from "./stripe";
import type { BillingProviderAdapter } from "./types";

const providers: Record<"mollie" | "stripe", BillingProviderAdapter> = {
  mollie: mollieAdapter,
  stripe: stripeAdapter,
};

export function getProvider(name: "mollie" | "stripe"): BillingProviderAdapter {
  return providers[name];
}

export * from "./types";
