// Central place to check which external services are connected.
// Anything not configured falls back to demo mode instead of crashing.

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
export const isSupabaseAdminConfigured = Boolean(isSupabaseConfigured && env.supabaseSecretKey);
export const isRazorpayConfigured = Boolean(env.razorpayKeyId && env.razorpayKeySecret);
