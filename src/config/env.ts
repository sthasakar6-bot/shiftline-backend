import "dotenv/config";

export const env = {
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
  corsOrigin: process.env.CORS_ORIGIN || "",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  appUrl: process.env.APP_URL || "https://app.shiftline.nl",
  mollieApiKey: process.env.MOLLIE_API_KEY || "",
  mollieWebhookSecret: process.env.MOLLIE_WEBHOOK_SECRET || "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripePriceStarterMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || "",
  stripePriceStarterYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || "",
  stripePriceUnlimitedMonthly: process.env.STRIPE_PRICE_UNLIMITED_MONTHLY || "",
  stripePriceUnlimitedYearly: process.env.STRIPE_PRICE_UNLIMITED_YEARLY || "",
};
