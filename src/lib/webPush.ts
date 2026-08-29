import webpush from "web-push";
import { env } from "../config/env";
import { findSubscriptionsByUser, deleteSubscriptionByEndpoint } from "../modules/push/model";

const configured = Boolean(env.vapidPublicKey && env.vapidPrivateKey);

if (configured) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
}

export async function sendPushToUser(
  userId: number,
  payload: { title: string; body: string; url?: string },
) {
  if (!configured) {
    return;
  }

  const subscriptions = await findSubscriptionsByUser(userId);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription expired or was revoked by the browser -- clean it up.
          await deleteSubscriptionByEndpoint(sub.endpoint);
        }
      }
    }),
  );
}
