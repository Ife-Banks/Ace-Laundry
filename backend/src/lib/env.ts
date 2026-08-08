import "dotenv/config";

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: num("PORT", 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  operatorPassword: process.env.OPERATOR_PASSWORD ?? "",
  // Session secret used to sign the operator auth token. Change before going live.
  operatorSessionSecret: process.env.OPERATOR_SESSION_SECRET ?? "dev-operator-session-secret",
  // Public base URL of the Next.js app (used as Flutterwave redirect target).
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  // Business contact number shown to customers as a Call/WhatsApp button.
  // Stored as a Nigerian local number, e.g. "08123456789".
  businessPhone: process.env.BUSINESS_PHONE ?? "",

  // Payment gateway: Flutterwave V3
  flutterwavePublicKey: process.env.FLUTTERWAVE_PUBLIC_KEY ?? "",
  flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? "",
  flutterwaveSecretHash: process.env.FLUTTERWAVE_SECRET_HASH ?? "",
  flutterwaveEnv: process.env.FLUTTERWAVE_ENV ?? "test",
  // The gateway's /payments endpoint requires a customer email; the product
  // deliberately collects no email, so charge under a fixed business address.
  flutterwavePaymentEmail: process.env.FLUTTERWAVE_PAYMENT_EMAIL ?? "payments@example.com",

  // Notifications (session 4 onwards)
  termiiApiKey: process.env.TERMII_API_KEY ?? "",
  termiiSenderId: process.env.TERMII_SENDER_ID ?? "AceLaundry",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
  // Email via SendLib. When SL_FROM is blank the gateway falls back to the
  // first Gmail account connected to the SendLib account.
  slApiKey: process.env.SL_API_KEY ?? "",
  slFrom: process.env.SL_FROM ?? "",
  // Origin SendLib requires on requests. SendLib gates each API key by an
  // allowed-origins list; our server-to-server calls carry no browser origin,
  // so we send this header explicitly and it must be whitelisted for the key.
  slOrigin: process.env.SL_ORIGIN ?? "http://localhost:4000",
  operatorEmail: process.env.OPERATOR_EMAIL ?? "",
};
