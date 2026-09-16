import { Client, SignatureValidator } from "mollie-api-typescript";
import { env } from "../../../config/env";
import { AppError } from "../../../errors/AppError";
import type {
  CheckoutParams,
  CheckoutResult,
  AddonCheckoutParams,
  NormalizedWebhookEvent,
  PlanKey,
  BillingInterval,
} from "./types";

// Lazy + memoized: this module is imported at server startup regardless of whether billing
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

// Placeholder default -- well above the ~$3-6/mo real Claude API cost at
// realistic usage; the final number is a business decision, not a
// technical one. Flat monthly only, no yearly variant -- kept as a simple
// toggle rather than mirroring the base plan's interval choice.
const AI_ASSISTANT_PRICE_EUR = { currency: "EUR", value: "4.99" };

// Mollie has no way to create a subscription up front: a subscription
// needs a mandate, and a mandate only exists once a "first" payment has
// actually been completed by the customer. So checkout here means "create
// a customer + a first payment", and the Subscription itself is created
// later, inside the webhook handler, once that first payment clears (see
// handlePaymentWebhook below).
export async function createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
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

  // No webhookUrl here: this account uses a centrally-registered next-gen
  // webhook subscription (Mollie Dashboard -> Developers -> Webhooks) that
  // delivers signed JSON events for matching event types to our one
  // endpoint, independent of any per-resource webhookUrl. Passing an
  // inline webhookUrl too would risk a second, unsigned "classic" delivery
  // to the same endpoint that verifyAndParseWebhook can't parse.
  const payment = await mollie().payments.create({
    paymentRequest: {
      amount: amountFor(params.plan, params.interval),
      description: `Shiftline ${params.plan} (${params.interval}) -- ${params.companyName}`,
      redirectUrl: `${env.appUrl}/admin?tab=billing&checkout=success`,
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

// Same shape as createCheckoutSession above, minus plan/interval -- this is
// its own independent subscription rather than folded into the base
// plan's, so the two can be subscribed to and canceled separately.
export async function createAddonCheckoutSession(params: AddonCheckoutParams): Promise<CheckoutResult> {
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
      amount: AI_ASSISTANT_PRICE_EUR,
      description: `Shiftline AI Assistant -- ${params.companyName}`,
      redirectUrl: `${env.appUrl}/admin?tab=assistant&checkout=success`,
      customerId,
      sequenceType: "first",
      metadata: {
        companyId: String(params.companyId),
        product: "aiAssistant",
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
    const isAddon = meta?.product === "aiAssistant";
    const plan = meta?.plan === "starter" || meta?.plan === "unlimited" ? meta.plan : undefined;
    const interval =
      meta?.interval === "monthly" || meta?.interval === "yearly" ? meta.interval : undefined;

    let subscriptionId: string | null = null;
    if (payment.sequenceType === "first" && payment.mandateId) {
      if (isAddon) {
        // Same reasoning as the plan branch below: no inline webhookUrl,
        // the central next-gen subscription delivers renewal events too.
        const subscription = await mollie().subscriptions.create({
          customerId,
          subscriptionRequest: {
            amount: AI_ASSISTANT_PRICE_EUR,
            interval: "1 month",
            description: "Shiftline AI Assistant",
            mandateId: payment.mandateId,
          },
        });
        subscriptionId = subscription.id ?? null;
      } else if (plan && interval) {
        const subscription = await mollie().subscriptions.create({
          customerId,
          subscriptionRequest: {
            amount: amountFor(plan, interval),
            interval: mollieInterval(interval),
            description: `Shiftline ${plan} (${interval})`,
            mandateId: payment.mandateId,
          },
        });
        subscriptionId = subscription.id ?? null;
      }
    }

    return {
      providerCustomerId: customerId,
      providerSubscriptionId: subscriptionId,
      type: "payment_succeeded",
      product: isAddon ? "aiAssistant" : "plan",
      plan: isAddon ? undefined : plan,
      interval: isAddon ? undefined : interval,
    };
  }

  if (payment.status === "failed" || payment.status === "expired" || payment.status === "canceled") {
    const meta = payment.metadata as Record<string, string> | undefined;
    return {
      providerCustomerId: customerId,
      providerSubscriptionId: null,
      type: "payment_failed",
      product: meta?.product === "aiAssistant" ? "aiAssistant" : "plan",
    };
  }

  throw new AppError(400, `Unhandled Mollie payment status: ${payment.status}`);
}

export async function verifyAndParseWebhook(
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
        // Best-effort placeholder -- this embedded payload carries no
        // metadata to read a real product tag from (only id/customerId/
        // status), so applyWebhookEvent in service.ts ignores this field
        // for cancellations and instead compares providerSubscriptionId
        // against the company's own stored billingSubscriptionId /
        // aiAssistantSubscriptionId to find the real target.
        product: "plan",
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
