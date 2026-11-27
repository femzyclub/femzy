// Central place to check which external services are connected.
// Anything not configured falls back to demo mode instead of crashing.

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  // Supabase calls this the "secret key" in newer dashboards; accept either name.
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "",
  cashfreeAppId: process.env.CASHFREE_APP_ID ?? "",
  cashfreeSecretKey: process.env.CASHFREE_SECRET_KEY ?? "",
  cashfreeEnvironment: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox",
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
export const isSupabaseAdminConfigured = Boolean(isSupabaseConfigured && env.supabaseServiceRoleKey);
export const isCashfreeConfigured = Boolean(env.cashfreeAppId && env.cashfreeSecretKey);
