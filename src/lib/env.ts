// Central place to check which external services are connected.
// Anything not configured falls back to demo mode instead of crashing.

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  upiId: process.env.NEXT_PUBLIC_UPI_ID ?? "",
  upiName: process.env.NEXT_PUBLIC_UPI_NAME ?? "Fem Rise Club",
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isSupabaseAdminConfigured = Boolean(isSupabaseConfigured && env.supabaseServiceRoleKey);
