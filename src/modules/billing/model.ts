import { db } from "../../prisma/db";

// Billing mutations on Company: a distinct, cross-cutting concern from
// company/model.ts's narrow "list + logo" scope for pre-login screens --
// identity/service.ts already sets the precedent of one module writing to
// another module's table via its own dedicated mutators.

export async function setBillingCustomer(
  companyId: number,
  data: { billingProvider: string; billingCustomerId: string; billingInterval: string | null },
): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update(data);
}

export async function activatePlan(
  companyId: number,
  data: { plan: string; billingSubscriptionId: string | null; billingInterval: string },
): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update({
    plan: data.plan,
    trialEndsAt: null,
    subscriptionStatus: "active",
    billingSubscriptionId: data.billingSubscriptionId,
    billingInterval: data.billingInterval,
  });
}

export async function markPastDue(companyId: number): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update({ subscriptionStatus: "past_due" });
}

export async function markCanceled(companyId: number): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update({ subscriptionStatus: "canceled" });
}

export async function activateAiAssistant(
  companyId: number,
  subscriptionId: string | null,
): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update({
    aiAssistantStatus: "active",
    aiAssistantSubscriptionId: subscriptionId,
  });
}

export async function markAiAssistantPastDue(companyId: number): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update({ aiAssistantStatus: "past_due" });
}

export async function markAiAssistantCanceled(companyId: number): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update({ aiAssistantStatus: "canceled" });
}

export async function schedulePendingPlan(
  companyId: number,
  data: { pendingPlan: string; pendingInterval: string },
): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update(data);
}

export async function clearPendingPlan(companyId: number): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update({
    pendingPlan: null,
    pendingInterval: null,
  });
}

export async function clearBillingSubscription(companyId: number): Promise<void> {
  await db.orm.public.Company.where({ id: companyId }).update({
    billingSubscriptionId: null,
  });
}

export async function findCompanyByBillingCustomer(
  billingProvider: string,
  billingCustomerId: string,
): Promise<{
  id: number;
  billingSubscriptionId: string | null;
  aiAssistantSubscriptionId: string | null;
} | null> {
  return db.orm.public.Company.select("id", "billingSubscriptionId", "aiAssistantSubscriptionId")
    .where({ billingProvider, billingCustomerId })
    .first();
}
