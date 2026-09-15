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
  // Only meaningful on payment_succeeded -- carried via metadata set at
  // checkout time, so the service layer knows which plan/interval to
  // activate without re-deriving it from a price id.
  plan?: PlanKey;
  interval?: BillingInterval;
}

export interface BillingProviderAdapter {
  readonly name: "mollie" | "stripe";
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>;
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalizedWebhookEvent>;
}
