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
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  ictAdminEmail: process.env.ICT_ADMIN_EMAIL || "",
  ictAdminPasswordHash: process.env.ICT_ADMIN_PASSWORD_HASH || "",
};
