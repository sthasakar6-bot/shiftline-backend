export type PlanKey = "starter" | "unlimited";
export type BillingInterval = "monthly" | "yearly";

export interface CheckoutParams {
  companyId: number;
  companyName: string;
  managerEmail: string;
  plan: PlanKey;
  interval: BillingInterval;
  existingCustomerId: string | null;
}

export interface CheckoutResult {
  redirectUrl: string;
  providerCustomerId: string;
}

export interface NormalizedWebhookEvent {
  providerCustomerId: string;
  providerSubscriptionId: string | null;
  type: "payment_succeeded" | "payment_failed" | "subscription_canceled";
  // Which of a company's (up to two) independent subscriptions this event
  // is about. For "subscription_canceled" this is a best-effort tag only --
  // the service layer re-derives the real target by comparing
  // providerSubscriptionId against the company's own stored subscription
  // ids, since Mollie's cancellation webhook payload carries no metadata to
  // read a reliable tag from (see mollie.ts).
  product: "plan" | "aiAssistant";
  // Only meaningful on payment_succeeded when product === "plan" -- carried
  // via metadata set at checkout time, so the service layer knows which
  // plan/interval to activate without re-deriving it from a price id.
  plan?: PlanKey;
  interval?: BillingInterval;
}

export interface AddonCheckoutParams {
  companyId: number;
  companyName: string;
  managerEmail: string;
  existingCustomerId: string | null;
}
