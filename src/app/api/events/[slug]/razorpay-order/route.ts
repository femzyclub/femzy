import { NextResponse, type NextRequest } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";
import { env, isRazorpayConfigured } from "@/lib/env";
import { registrationErrorMessage } from "@/lib/events/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!isRazorpayConfigured) return bad("Online payments are not configured yet.", 503);
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return bad("Registrations aren't connected yet.", 503);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Invalid registration.");

  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const age = Number(body.age);
  const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers) ? body.answers : {};
  if (fullName.length < 2 || fullName.length > 100) return bad("Please enter your full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return bad("Please enter a valid email address.");
  if (!/^\+?[0-9][0-9 -]{6,19}$/.test(phone)) return bad("Please enter a valid phone number.");
  if (!Number.isInteger(age) || age < 1 || age > 120) return bad("Please enter a valid age.");

  const { data: event } = await supabase.from("events").select("id").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!event) return bad("This event isn't open for registration.", 404);
  const { data, error } = await supabase.rpc("begin_razorpay_event_registration", {
    p_event: event.id,
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_age: age,
    p_answers: answers,
  });
  if (error || !data?.[0]) return bad(registrationErrorMessage(error?.message ?? "") ?? "Couldn't begin the payment. Please try again.", 409);
  const registration = data[0] as { registration_id: string; registration_code: string; amount: number; event_title: string };

  try {
    const order = await createRazorpayOrder({
      amount: registration.amount,
      receipt: registration.registration_code.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40),
      notes: { registration_id: registration.registration_id, registration_code: registration.registration_code, event_slug: slug },
    });
    const { error: attachError } = await supabase.rpc("attach_razorpay_order", { p_registration: registration.registration_id, p_order_id: order.id });
    if (attachError) throw new Error("Your payment session expired. Please try again.");
    return NextResponse.json({ registrationId: registration.registration_id, orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.razorpayKeyId, title: registration.event_title, email, phone });
  } catch (err) {
    console.error("[razorpay] order creation failed", err);
    return bad(err instanceof Error ? err.message : "Couldn't begin the payment. Please try again.", 502);
  }
}
