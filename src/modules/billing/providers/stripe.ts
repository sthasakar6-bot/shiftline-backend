import Stripe from "stripe";
import { env } from "../../../config/env";
import { AppError } from "../../../errors/AppError";
import type {
  BillingProviderAdapter,
  CheckoutParams,
  CheckoutResult,
  NormalizedWebhookEvent,
  PlanKey,
  BillingInterval,
} from "./types";

// Lazy + memoized: constructing a Stripe client with an empty key throws
// immediately ("Neither apiKey nor config.authenticator provided"). Every
// module that (transitively) imports this file gets loaded at server
// startup regardless of whether billing env vars are configured yet, so
// eagerly constructing this at module scope would crash the whole app
// (and every test) before a real STRIPE_SECRET_KEY exists.
let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey);
  }
  return stripeClient;
}

function priceIdFor(plan: PlanKey, interval: BillingInterval): string {
  const key =
    plan === "starter"
      ? interval === "monthly"
        ? env.stripePriceStarterMonthly
        : env.stripePriceStarterYearly
      : interval === "monthly"
        ? env.stripePriceUnlimitedMonthly
        : env.stripePriceUnlimitedYearly;
  if (!key) {
    throw new AppError(500, `No Stripe price configured for ${plan}/${interval}`);
  }
  return key;
}

async function createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: params.existingCustomerId ?? undefined,
    customer_email: params.existingCustomerId ? undefined : params.managerEmail,
    line_items: [{ price: priceIdFor(params.plan, params.interval), quantity: 1 }],
    subscription_data: {
      metadata: {
        companyId: String(params.companyId),
        plan: params.plan,
        interval: params.interval,
      },
    },
    success_url: `${env.appUrl}/admin?tab=billing&checkout=success`,
    cancel_url: `${env.appUrl}/admin?tab=billing&checkout=canceled`,
    automatic_tax: { enabled: true },
  });

  if (!session.url) {
    throw new AppError(500, "Stripe did not return a checkout URL");
  }
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) {
    throw new AppError(500, "Stripe checkout session has no customer id");
  }

  return { redirectUrl: session.url, providerCustomerId: customerId };
}

// Stripe API 2025-03-31.basil+ moved the invoice-to-subscription link under
// `parent.subscription_details` (the old top-level `invoice.subscription`
// field was removed) -- confirmed against Stripe's own changelog.
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  if (invoice.parent?.type !== "subscription_details") return null;
  const subscriptionId = invoice.parent.subscription_details?.subscription;
  return typeof subscriptionId === "string" ? subscriptionId : (subscriptionId?.id ?? null);
}

// invoice.paid fires for both the first payment and every renewal -- the
// one event that actually activates/keeps a plan active. Subscription
// metadata (companyId/plan/interval, set at checkout time) lives on the
// Subscription object, not the Invoice, so it's fetched as a follow-up call.
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<NormalizedWebhookEvent> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subscriptionIdStr = subscriptionIdFromInvoice(invoice);

  if (!customerId) {
    throw new AppError(400, "Stripe invoice.paid webhook missing customer id");
  }

  let plan: PlanKey | undefined;
  let interval: BillingInterval | undefined;
  if (subscriptionIdStr) {
    const subscription = await stripe().subscriptions.retrieve(subscriptionIdStr);
    const meta = subscription.metadata;
    if (meta.plan === "starter" || meta.plan === "unlimited") plan = meta.plan;
    if (meta.interval === "monthly" || meta.interval === "yearly") interval = meta.interval;
  }

  return {
    providerCustomerId: customerId,
    providerSubscriptionId: subscriptionIdStr,
    type: "payment_succeeded",
    plan,
    interval,
  };
}

function handleInvoicePaymentFailed(invoice: Stripe.Invoice): NormalizedWebhookEvent {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subscriptionIdStr = subscriptionIdFromInvoice(invoice);
  if (!customerId) {
    throw new AppError(400, "Stripe invoice.payment_failed webhook missing customer id");
  }
  return {
    providerCustomerId: customerId,
    providerSubscriptionId: subscriptionIdStr,
    type: "payment_failed",
  };
}

function handleSubscriptionDeleted(subscription: Stripe.Subscription): NormalizedWebhookEvent {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) {
    throw new AppError(400, "Stripe customer.subscription.deleted webhook missing customer id");
  }
  return {
    providerCustomerId: customerId,
    providerSubscriptionId: subscription.id,
    type: "subscription_canceled",
  };
}

async function verifyAndParseWebhook(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
): Promise<NormalizedWebhookEvent> {
  const signature = headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    throw new AppError(400, "Missing Stripe-Signature header");
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch {
    throw new AppError(400, "Invalid Stripe webhook signature");
  }

  switch (event.type) {
    case "invoice.paid":
      return handleInvoicePaid(event.data.object as Stripe.Invoice);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    default:
      throw new AppError(400, `Unhandled Stripe event type: ${event.type}`);
  }
}

export const stripeAdapter: BillingProviderAdapter = {
  name: "stripe",
  createCheckoutSession,
  verifyAndParseWebhook,
};
