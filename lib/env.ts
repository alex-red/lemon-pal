import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const env = {
  paypalClientId: () => required("PAYPAL_CLIENT_ID"),
  paypalClientSecret: () => required("PAYPAL_CLIENT_SECRET"),
  paypalApiBase: () =>
    process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
  paypalSdkUrl: () =>
    process.env.PAYPAL_ENV === "live"
      ? "https://www.paypal.com/web-sdk/v6/core"
      : "https://www.sandbox.paypal.com/web-sdk/v6/core",
  currency: () => process.env.STAND_CURRENCY || "USD",
  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  publicAppUrl: () => process.env.PUBLIC_APP_URL || null,
  // AG licence keys are designed to ship to the browser.
  agStudioLicenseKey: () => process.env.AG_STUDIO_LICENSE_KEY || null,
};
