// Central place to check which external services are connected.
// Anything not configured falls back to demo mode instead of crashing.
//
// Server secrets are read through getters, at the moment they're needed, not
// once when the module loads. On Cloudflare Workers the runtime variables are
// only guaranteed to be in process.env while a request is being handled.
// NEXT_PUBLIC_* values are baked in at build time either way.

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  // Supabase calls this the "secret key" in newer dashboards; accept either name.
  get supabaseServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  },
  get cashfreeAppId() {
    return process.env.CASHFREE_APP_ID ?? "";
  },
  get cashfreeSecretKey() {
    return process.env.CASHFREE_SECRET_KEY ?? "";
  },
  get cashfreeEnvironment(): "production" | "sandbox" {
    return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
  },
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
export const isSupabaseAdminConfigured = () => Boolean(isSupabaseConfigured && env.supabaseServiceRoleKey);
export const isCashfreeConfigured = () => Boolean(env.cashfreeAppId && env.cashfreeSecretKey);
