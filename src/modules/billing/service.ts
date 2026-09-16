import { AppError } from "../../errors/AppError";
import { findCompanyById } from "../company/model";
import { findUserById } from "../identity/model";
import { getProvider, type PlanKey, type BillingInterval, type NormalizedWebhookEvent } from "./providers";
import {
  setBillingCustomer,
  activatePlan,
  markPastDue,
  markCanceled,
  activateAiAssistant,
  markAiAssistantPastDue,
  markAiAssistantCanceled,
  findCompanyByBillingCustomer,
} from "./model";

export async function initiateCheckout(
  companyId: number,
  managerId: number,
  plan: PlanKey,
  interval: BillingInterval,
  providerName: "mollie" | "stripe",
): Promise<{ redirectUrl: string }> {
  const company = await findCompanyById(companyId);
  if (!company) {
    throw new AppError(404, "Company not found");
  }
  const manager = await findUserById(managerId);
  if (!manager) {
    throw new AppError(404, "Manager not found");
  }

  // A company already on this same provider keeps its existing customer
  // record (avoids creating a duplicate customer on every plan change);
  // switching providers starts a fresh customer on the new one.
  const existingCustomerId = company.billingProvider === providerName ? company.billingCustomerId : null;

  const provider = getProvider(providerName);
  const { redirectUrl, providerCustomerId } = await provider.createCheckoutSession({
    companyId: company.id,
    companyName: company.name,
    managerEmail: manager.email,
    plan,
    interval,
    existingCustomerId,
  });

  await setBillingCustomer(company.id, {
    billingProvider: providerName,
    billingCustomerId: providerCustomerId,
    billingInterval: interval,
  });

  return { redirectUrl };
}

// Same shape as initiateCheckout above, minus plan/interval. The add-on
// reuses the company's existing billing identity (customer id) when it's
// already on this same provider -- exactly the same reuse rule the base
// plan already applies. When it isn't (no billing identity yet, or a
// different provider), a fresh customer is created and billingProvider/
// billingCustomerId are (re)written, preserving whatever billingInterval
// already held since that field belongs to the base plan, not this add-on.
export async function initiateAddonCheckout(
  companyId: number,
  managerId: number,
  providerName: "mollie" | "stripe",
): Promise<{ redirectUrl: string }> {
  const company = await findCompanyById(companyId);
  if (!company) {
    throw new AppError(404, "Company not found");
  }
  const manager = await findUserById(managerId);
  if (!manager) {
    throw new AppError(404, "Manager not found");
  }

  const alreadyOnThisProvider = company.billingProvider === providerName;
  const existingCustomerId = alreadyOnThisProvider ? company.billingCustomerId : null;

  const provider = getProvider(providerName);
  const { redirectUrl, providerCustomerId } = await provider.createAddonCheckoutSession({
    companyId: company.id,
    companyName: company.name,
    managerEmail: manager.email,
    existingCustomerId,
  });

  if (!alreadyOnThisProvider) {
    await setBillingCustomer(company.id, {
      billingProvider: providerName,
      billingCustomerId: providerCustomerId,
      billingInterval: company.billingInterval,
    });
  }

  return { redirectUrl };
}

export async function getBillingStatus(companyId: number) {
  const company = await findCompanyById(companyId);
  if (!company) {
    throw new AppError(404, "Company not found");
  }
  return {
    plan: company.plan,
    trialEndsAt: company.trialEndsAt,
    billingProvider: company.billingProvider,
    billingInterval: company.billingInterval,
    subscriptionStatus: company.subscriptionStatus,
    aiAssistantStatus: company.aiAssistantStatus,
  };
}

export async function handleWebhook(
  providerName: "mollie" | "stripe",
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const provider = getProvider(providerName);
  const event = await provider.verifyAndParseWebhook(rawBody, headers);
  await applyWebhookEvent(providerName, event);
}

async function applyWebhookEvent(
  providerName: "mollie" | "stripe",
  event: NormalizedWebhookEvent,
): Promise<void> {
  // The checkout-initiation write (setBillingCustomer, above) always
  // persists billingProvider/billingCustomerId before the customer can
  // possibly reach a payment page, so this lookup is always reliable --
  // no metadata-based fast path is needed as a separate case.
  const company = await findCompanyByBillingCustomer(providerName, event.providerCustomerId);
  if (!company) {
    throw new AppError(404, `No company found for ${providerName} customer ${event.providerCustomerId}`);
  }

  switch (event.type) {
    case "payment_succeeded": {
      if (event.product === "aiAssistant") {
        await activateAiAssistant(company.id, event.providerSubscriptionId);
        return;
      }
      if (!event.plan || !event.interval) {
        throw new AppError(400, "payment_succeeded event missing plan/interval metadata");
      }
      await activatePlan(company.id, {
        plan: event.plan,
        billingSubscriptionId: event.providerSubscriptionId,
        billingInterval: event.interval,
      });
      return;
    }
    case "payment_failed":
      if (event.product === "aiAssistant") {
        await markAiAssistantPastDue(company.id);
      } else {
        await markPastDue(company.id);
      }
      return;
    case "subscription_canceled": {
      // event.product is a best-effort tag at best (Mollie's cancellation
      // payload carries no metadata to tag it from at all -- see
      // providers/mollie.ts) -- the real target is derived here by
      // comparing the subscription id itself against what this company has
      // on file for each of its two independent subscriptions. A duplicate
      // or late cancellation webhook for an id that matches neither (e.g.
      // already cleared by an earlier delivery) is a no-op, not an error.
      if (event.providerSubscriptionId && event.providerSubscriptionId === company.aiAssistantSubscriptionId) {
        await markAiAssistantCanceled(company.id);
      } else if (
        event.providerSubscriptionId &&
        event.providerSubscriptionId === company.billingSubscriptionId
      ) {
        await markCanceled(company.id);
      }
      return;
    }
  }
}
