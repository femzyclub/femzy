import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { registrationErrorMessage } from "@/lib/events/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Event registration (guests and signed-in members).
 * Every rule — open window, deadline, capacity (row-locked), duplicates, required fields,
 * UTR reuse — is enforced again inside the database function register_for_event().
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return bad("Registrations aren't connected yet.", 503);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Invalid request.");
  }

  const fullName = String(form.get("fullName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim();
  const age = Number(form.get("age"));
  let answers: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(form.get("answers") ?? "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      answers = Object.fromEntries(Object.entries(parsed).slice(0, 50).map(([k, v]) => [String(k).slice(0, 60), String(v ?? "").slice(0, 1000)]));
    }
  } catch {
    /* ignore malformed answers — required ones are re-checked in the database */
  }

  if (fullName.length < 2 || fullName.length > 100) return bad("Please enter your full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return bad("Please enter a valid email address.");
  if (!/^\+?[0-9][0-9 -]{6,19}$/.test(phone)) return bad("Please enter a valid phone number.");
  if (!Number.isInteger(age) || age < 1 || age > 120) return bad("Please enter a valid age.");

  const { data: event } = await supabase.from("events").select("id, fee, status").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!event) return bad("This event isn't open for registration.", 404);
  if (event.fee > 0) return bad("Paid event registrations must be completed through Cashfree.", 409);

  // Free events are confirmed immediately.
  const { data, error } = await supabase.rpc("register_for_event", {
    p_event: event.id,
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_age: age,
    p_answers: answers,
    p_utr: null,
    p_proof_path: null,
  });

  if (error) {
    const friendly = registrationErrorMessage(error.message);
    if (!friendly) console.error("[events] register failed", error.message);
    // Unique index hit by a perfectly simultaneous duplicate.
    if (!friendly && error.code === "23505") return bad(registrationErrorMessage("ALREADY_REGISTERED")!, 409);
    return bad(friendly ?? "Something went wrong. Please try again.", friendly ? 409 : 500);
  }

  const row = (Array.isArray(data) ? data[0] : data) as { registration_code: string; status: string } | undefined;
  if (!row) return bad("Something went wrong. Please try again.", 500);

  // Seat counts changed — refresh the public pages.
  revalidatePath("/events", "layout");
  revalidatePath("/");
  return NextResponse.json({ code: row.registration_code, status: row.status });
}
