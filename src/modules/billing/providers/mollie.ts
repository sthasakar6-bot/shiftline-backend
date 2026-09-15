import { Client, SignatureValidator } from "mollie-api-typescript";
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

// Lazy + memoized -- same reasoning as the Stripe adapter's lazy client:
// this module is imported at server startup regardless of whether billing
// env vars are configured yet, so constructing the client eagerly risks
// crashing the whole app before a real MOLLIE_API_KEY exists.
let mollieClient: Client | null = null;
function mollie(): Client {
  if (!mollieClient) {
    mollieClient = new Client({ testmode: false, security: { apiKey: env.mollieApiKey } });
  }
  return mollieClient;
}

const PRICE_EUR: Record<PlanKey, string> = {
  starter: "9.99",
  unlimited: "19.99",
};

// Yearly totals match the 20% discount already live on the marketing site's
// pricing cards (e.g. Starter: 9.99 * 12 * 0.8).
const YEARLY_PRICE_EUR: Record<PlanKey, string> = {
  starter: "95.90",
  unlimited: "191.90",
};

function amountFor(plan: PlanKey, interval: BillingInterval) {
  const value = interval === "monthly" ? PRICE_EUR[plan] : YEARLY_PRICE_EUR[plan];
  return { currency: "EUR", value };
}

function mollieInterval(interval: BillingInterval): string {
  return interval === "monthly" ? "1 month" : "12 months";
}

// Mollie has no Stripe-Checkout equivalent that creates a subscription up
// front: a subscription needs a mandate, and a mandate only exists once a
// "first" payment has actually been completed by the customer. So checkout
// here means "create a customer + a first payment", and the Subscription
// itself is created later, inside the webhook handler, once that first
// payment clears (see handlePaymentWebhook below). This asymmetry is
// intentionally contained in this file -- the rest of the app just sees
// "payment_succeeded".
async function createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
  let customerId = params.existingCustomerId;
  if (!customerId) {
    const customer = await mollie().customers.create({
      entityCustomer: { name: params.companyName, email: params.managerEmail },
    });
    customerId = customer.id;
  }
  if (!customerId) {
    throw new AppError(500, "Mollie did not return a customer id");
  }

  const payment = await mollie().payments.create({
    paymentRequest: {
      amount: amountFor(params.plan, params.interval),
      description: `Shiftline ${params.plan} (${params.interval}) -- ${params.companyName}`,
      redirectUrl: `${env.appUrl}/admin?tab=billing&checkout=success`,
      webhookUrl: `${env.appUrl.replace("app.", "")}/api/billing/webhooks/mollie`,
      customerId,
      sequenceType: "first",
      metadata: {
        companyId: String(params.companyId),
        plan: params.plan,
        interval: params.interval,
      },
    },
  });

  const redirectUrl = payment.links?.checkout?.href;
  if (!redirectUrl) {
    throw new AppError(500, "Mollie did not return a checkout URL");
  }

  return { redirectUrl, providerCustomerId: customerId };
}

async function handlePaymentWebhook(paymentId: string): Promise<NormalizedWebhookEvent> {
  const payment = await mollie().payments.get({ paymentId });
  const customerId = payment.customerId;
  if (!customerId) {
    throw new AppError(400, `Mollie payment ${paymentId} has no customer id`);
  }

  if (payment.status === "paid") {
    const meta = payment.metadata as Record<string, string> | undefined;
    const plan = meta?.plan === "starter" || meta?.plan === "unlimited" ? meta.plan : undefined;
    const interval =
      meta?.interval === "monthly" || meta?.interval === "yearly" ? meta.interval : undefined;

    let subscriptionId: string | null = null;
    if (payment.sequenceType === "first" && payment.mandateId && plan && interval) {
      const subscription = await mollie().subscriptions.create({
        customerId,
        subscriptionRequest: {
          amount: amountFor(plan, interval),
          interval: mollieInterval(interval),
          description: `Shiftline ${plan} (${interval})`,
          webhookUrl: `${env.appUrl.replace("app.", "")}/api/billing/webhooks/mollie`,
          mandateId: payment.mandateId,
        },
      });
      subscriptionId = subscription.id ?? null;
    }

    return {
      providerCustomerId: customerId,
      providerSubscriptionId: subscriptionId,
      type: "payment_succeeded",
      plan,
      interval,
    };
  }

  if (payment.status === "failed" || payment.status === "expired" || payment.status === "canceled") {
    return {
      providerCustomerId: customerId,
      providerSubscriptionId: null,
      type: "payment_failed",
    };
  }

  throw new AppError(400, `Unhandled Mollie payment status: ${payment.status}`);
}

async function verifyAndParseWebhook(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
): Promise<NormalizedWebhookEvent> {
  const signature = headers["x-mollie-signature"];
  if (!signature || Array.isArray(signature)) {
    throw new AppError(400, "Missing X-Mollie-Signature header");
  }

  // validate() resolves true on a match, resolves false only when no
  // signature was supplied at all, and *throws* InvalidSignatureException
  // when a signature was supplied but didn't match -- all three outcomes
  // need to end up as the same 400 here.
  let verified = false;
  try {
    verified = await SignatureValidator.validate(
      rawBody.toString("utf8"),
      [env.mollieWebhookSecret],
      signature,
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    throw new AppError(400, "Invalid Mollie webhook signature");
  }

  const event = JSON.parse(rawBody.toString("utf8")) as {
    resource?: string;
    entityId?: string;
    _embedded?: { entity?: { id?: string; customerId?: string; status?: string } };
  };

  if (event.resource === "payment" && event.entityId) {
    return handlePaymentWebhook(event.entityId);
  }

  if (event.resource === "subscription") {
    // Mollie's REST API nests subscriptions under a customer
    // (/customers/:customerId/subscriptions/:id) -- a bare subscription id
    // can't be fetched without already knowing its customer id, so this
    // handler depends on the webhook being registered in "full payload"
    // mode (delivers `_embedded.entity`, including customerId, directly in
    // the webhook body -- see the "what you need to do yourself" setup
    // notes). Without that, this event type can't be resolved at all.
    const entity = event._embedded?.entity;
    if (!entity?.customerId) {
      throw new AppError(
        400,
        "Mollie subscription webhook missing embedded customer context -- register this webhook in full-payload mode",
      );
    }
    if (entity.status === "canceled" || entity.status === "suspended") {
      return {
        providerCustomerId: entity.customerId,
        providerSubscriptionId: entity.id ?? event.entityId ?? null,
        type: "subscription_canceled",
      };
    }
    // Other subscription status changes (e.g. newly "active") aren't
    // independently actionable here -- plan activation is driven entirely
    // by payment_succeeded events above, not by the subscription resource
    // itself.
    throw new AppError(400, `Unhandled Mollie subscription status: ${entity.status}`);
  }

  throw new AppError(400, `Unhandled Mollie webhook resource: ${event.resource}`);
}

export const mollieAdapter: BillingProviderAdapter = {
  name: "mollie",
  createCheckoutSession,
  verifyAndParseWebhook,
};
