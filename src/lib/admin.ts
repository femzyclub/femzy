import "server-only";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Same admin check the payments page uses: signed in + profiles.role = 'admin'.
 * The database re-checks is_admin() on every write (RLS + SECURITY DEFINER functions).
 */
export async function requireAdmin(next = "/admin/events") {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") notFound();
  return { supabase, user };
}

/** For server actions: returns null instead of redirecting. */
export async function getAdminClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return null;
  return { supabase, user };
}
