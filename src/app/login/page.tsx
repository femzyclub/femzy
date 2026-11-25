import type { Metadata } from "next";
import { AuthShell } from "@/components/ui/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Admin sign in — Femzy", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin/events";
  return (
    <AuthShell kicker="Femzy team" title="Admin sign in">
      <LoginForm next={safeNext} supabaseReady={isSupabaseConfigured} />
    </AuthShell>
  );
}
