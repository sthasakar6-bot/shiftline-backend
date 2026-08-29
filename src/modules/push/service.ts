import { upsertSubscription, deleteSubscriptionByEndpoint } from "./model";

export async function subscribe(
  userId: number,
  data: { endpoint: string; p256dh: string; auth: string },
) {
  return upsertSubscription({ userId, ...data });
}

export async function unsubscribe(endpoint: string) {
  await deleteSubscriptionByEndpoint(endpoint);
}
