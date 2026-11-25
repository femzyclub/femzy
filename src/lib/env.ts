// Central place to check which external services are connected.
// Anything not configured falls back to demo mode instead of crashing.

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  upiId: process.env.NEXT_PUBLIC_UPI_ID ?? "",
  upiName: process.env.NEXT_PUBLIC_UPI_NAME ?? "Femzy",
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
export const isSupabaseAdminConfigured = Boolean(isSupabaseConfigured && env.supabaseSecretKey);
