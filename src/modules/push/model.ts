import { db } from "../../prisma/db";

export interface PushSubscription {
  id: number;
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

export async function findSubscriptionsByUser(userId: number): Promise<PushSubscription[]> {
  return db.orm.public.PushSubscription.where({ userId }).all();
}

export async function findSubscriptionByEndpoint(
  endpoint: string,
): Promise<PushSubscription | null> {
  return db.orm.public.PushSubscription.first({ endpoint });
}

export async function upsertSubscription(data: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<PushSubscription> {
  const existing = await findSubscriptionByEndpoint(data.endpoint);
  if (existing) {
    const updated = await db.orm.public.PushSubscription.where({ endpoint: data.endpoint }).update(
      { userId: data.userId, p256dh: data.p256dh, auth: data.auth },
    );
    return updated!;
  }
  return db.orm.public.PushSubscription.create(data);
}

export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await db.orm.public.PushSubscription.where({ endpoint }).delete();
}
