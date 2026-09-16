import { db } from "../../prisma/db";

export interface PendingSignup {
  id: number;
  email: string;
  plan: string;
  interval: string;
  billingCustomerId: string;
  billingSubscriptionId: string | null;
  paid: boolean;
  createdAt: string;
}

export async function findPendingSignupByEmail(email: string): Promise<PendingSignup | null> {
  return db.orm.public.PendingSignup.where({ email }).first();
}

export async function findPendingSignupByBillingCustomerId(
  billingCustomerId: string,
): Promise<PendingSignup | null> {
  return db.orm.public.PendingSignup.where({ billingCustomerId }).first();
}

// Called from startPurchase -- upserts so a retried/abandoned checkout
// re-uses the same row (and the same Mollie customer, via the caller
// passing that customer's existing id back in) instead of accumulating
// duplicates. Resets paid to false: if the plan/interval changed on a
// retry, the previous payment's confirmation shouldn't silently carry over.
export async function upsertPendingSignup(
  email: string,
  plan: string,
  interval: string,
  billingCustomerId: string,
): Promise<void> {
  const existing = await db.orm.public.PendingSignup.where({ email }).first();
  if (existing) {
    await db.orm.public.PendingSignup.where({ email }).update({
      plan,
      interval,
      billingCustomerId,
      paid: false,
    });
  } else {
    await db.orm.public.PendingSignup.create({ email, plan, interval, billingCustomerId, paid: false });
  }
}

export async function markPendingSignupPaid(email: string, subscriptionId: string | null): Promise<void> {
  await db.orm.public.PendingSignup.where({ email }).update({
    paid: true,
    billingSubscriptionId: subscriptionId,
  });
}

export async function deletePendingSignup(email: string): Promise<void> {
  await db.orm.public.PendingSignup.where({ email }).delete();
}
