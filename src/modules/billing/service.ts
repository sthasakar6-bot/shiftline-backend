import { AppError } from "../../errors/AppError";
import { findCompanyById } from "../company/model";
import { findUserById } from "../identity/model";
import { getProvider, type PlanKey, type BillingInterval, type NormalizedWebhookEvent } from "./providers";
import {
  setBillingCustomer,
  activatePlan,
  markPastDue,
  markCanceled,
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
      await markPastDue(company.id);
      return;
    case "subscription_canceled":
      await markCanceled(company.id);
      return;
  }
}
