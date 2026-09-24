import { Client, SignatureValidator } from "mollie-api-typescript";
import { env } from "../../../config/env";
import { AppError } from "../../../errors/AppError";
import type {
  CheckoutParams,
  CheckoutResult,
  AddonCheckoutParams,
  PresignupCheckoutParams,
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

// These are the net (VAT-exclusive) prices -- the marketing site advertises
// them as "+ VAT", and VAT is added on top at checkout (see withVat below),
// so what's actually charged is higher than these numbers.
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

// Flat 21% Dutch VAT for every customer regardless of location -- no
// reverse-charge handling for EU business customers yet (would need VAT
// number validation via VIES); can be added later if needed.
const VAT_RATE = 0.21;

interface PriceBreakdown {
  netValue: string;
  vatValue: string;
  grossValue: string;
}

function computeVat(netValue: string): PriceBreakdown {
  const net = Number(netValue);
  const vat = Math.round(net * VAT_RATE * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  return { netValue: net.toFixed(2), vatValue: vat.toFixed(2), grossValue: gross.toFixed(2) };
}

function amountFor(plan: PlanKey, interval: BillingInterval) {
  const netValue = interval === "monthly" ? PRICE_EUR[plan] : YEARLY_PRICE_EUR[plan];
  const { grossValue } = computeVat(netValue);
  return { currency: "EUR", value: grossValue };
}

function mollieInterval(interval: BillingInterval): string {
  return interval === "monthly" ? "1 month" : "12 months";
}

// Placeholder default -- well above the ~$3-6/mo real Claude API cost at
// realistic usage; the final number is a business decision, not a
// technical one. Flat monthly only, no yearly variant -- kept as a simple
// toggle rather than mirroring the base plan's interval choice. Net (pre-VAT).
const AI_ASSISTANT_NET_EUR = "4.99";
function aiAssistantAmount() {
  const { grossValue } = computeVat(AI_ASSISTANT_NET_EUR);
  return { currency: "EUR", value: grossValue };
}

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
      description: `Shiftline ${params.plan} (${params.interval}) incl. 21% VAT -- ${params.companyName}`,
      redirectUrl: `${env.appUrl}/admin?tab=billing&checkout=success`,
      customerId,
      sequenceType: "first",
      metadata: {
        companyId: String(params.companyId),
        plan: params.plan,
        interval: params.interval,
        ...computeVat(params.interval === "monthly" ? PRICE_EUR[params.plan] : YEARLY_PRICE_EUR[params.plan]),
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
      amount: aiAssistantAmount(),
      description: `Shiftline AI Assistant incl. 21% VAT -- ${params.companyName}`,
      redirectUrl: `${env.appUrl}/admin?tab=assistant&checkout=success`,
      customerId,
      sequenceType: "first",
      metadata: {
        companyId: String(params.companyId),
        product: "aiAssistant",
        ...computeVat(AI_ASSISTANT_NET_EUR),
      },
    },
  });

  const redirectUrl = payment.links?.checkout?.href;
  if (!redirectUrl) {
    throw new AppError(500, "Mollie did not return a checkout URL");
  }

  return { redirectUrl, providerCustomerId: customerId };
}

// Same shape as createCheckoutSession above, minus companyId -- no Company
// row exists yet at this point (see signup/service.ts startPurchase). The
// customer's Mollie-side "name" is just their email since the real company
// name isn't known yet -- that's Mollie-dashboard-only, never shown to the
// customer.
export async function createPresignupCheckoutSession(params: PresignupCheckoutParams): Promise<CheckoutResult> {
  let customerId = params.existingCustomerId;
  if (!customerId) {
    const customer = await mollie().customers.create({
      entityCustomer: { name: params.email, email: params.email },
    });
    customerId = customer.id;
  }
  if (!customerId) {
    throw new AppError(500, "Mollie did not return a customer id");
  }

  const payment = await mollie().payments.create({
    paymentRequest: {
      amount: amountFor(params.plan, params.interval),
      description: `Shiftline ${params.plan} (${params.interval}) incl. 21% VAT -- ${params.email}`,
      redirectUrl: `${env.appUrl}/complete-signup?email=${encodeURIComponent(params.email)}&plan=${params.plan}&interval=${params.interval}`,
      customerId,
      sequenceType: "first",
      metadata: {
        presignup: "true",
        email: params.email,
        plan: params.plan,
        interval: params.interval,
        ...computeVat(params.interval === "monthly" ? PRICE_EUR[params.plan] : YEARLY_PRICE_EUR[params.plan]),
      },
    },
  });

  const redirectUrl = payment.links?.checkout?.href;
  if (!redirectUrl) {
    throw new AppError(500, "Mollie did not return a checkout URL");
  }

  return { redirectUrl, providerCustomerId: customerId };
}

// Live lookup for the ICT admin company-detail view -- nothing here is
// stored locally (payment history, next renewal date), so it's fetched
// fresh from Mollie on each request rather than duplicated into our own
// schema. Best-effort: any Mollie API failure here should never break the
// rest of the company-detail response, so callers catch and fall back.
export async function getCustomerBillingSummary(customerId: string, subscriptionId: string | null) {
  const [paymentsPage, subscription] = await Promise.all([
    mollie().customers.listPayments({ customerId, limit: 10 }),
    subscriptionId
      ? mollie().subscriptions.get({ customerId, subscriptionId }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const payments = (paymentsPage.result.embedded.payments ?? []).map((p) => ({
    id: p.id,
    amount: p.amount,
    status: p.status,
    method: p.method ?? null,
    description: p.description,
    createdAt: p.createdAt,
    paidAt: p.paidAt ?? null,
  }));

  return {
    payments,
    nextPaymentDate: subscription?.nextPaymentDate ?? null,
    subscriptionStatus: subscription?.status ?? null,
  };
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
            amount: aiAssistantAmount(),
            interval: "1 month",
            description: "Shiftline AI Assistant incl. 21% VAT",
            mandateId: payment.mandateId,
          },
        });
        subscriptionId = subscription.id ?? null;
      } else if (plan && interval) {
        // Same subscription-creation shape for both a real company's
        // checkout and a presignup checkout -- plan/interval are present
        // in metadata either way, and the resulting subscription id is
        // just stored differently downstream (Company vs PendingSignup).
        const subscription = await mollie().subscriptions.create({
          customerId,
          subscriptionRequest: {
            amount: amountFor(plan, interval),
            interval: mollieInterval(interval),
            description: `Shiftline ${plan} (${interval}) incl. 21% VAT`,
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
