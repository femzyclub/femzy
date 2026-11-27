import { NextResponse, type NextRequest } from "next/server";
import { createCashfreeOrder } from "@/lib/cashfree";
import { env, isCashfreeConfigured } from "@/lib/env";
import { registrationErrorMessage } from "@/lib/events/shared";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

class SessionExpiredError extends Error {}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!isCashfreeConfigured()) {
    // Names only, never values, so the logs show which setting is missing.
    console.error("[cashfree] missing settings:", { CASHFREE_APP_ID: Boolean(env.cashfreeAppId), CASHFREE_SECRET_KEY: Boolean(env.cashfreeSecretKey) });
    return bad("Online payments are not available right now. Please try again later.", 503);
  }
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  // attach_cashfree_order is service-role only (007_cashfree_payment_hardening.sql).
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) {
    console.error("[cashfree] missing Supabase settings:", { publicClient: Boolean(supabase), SUPABASE_SECRET_KEY: Boolean(env.supabaseServiceRoleKey) });
    return bad("Registrations aren't available right now. Please try again later.", 503);
  }
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
  const { data, error } = await supabase.rpc("begin_cashfree_event_registration", {
    p_event: event.id,
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_age: age,
    p_answers: answers,
  });
  if (error || !data?.[0]) {
    console.error("[cashfree] begin_cashfree_event_registration failed", error?.code, error?.message, error?.details, error?.hint);
    // Raw database errors stay in the server logs; visitors only see plain English.
    if (error?.code === "23505") return bad(registrationErrorMessage("ALREADY_REGISTERED")!, 409);
    return bad(registrationErrorMessage(error?.message ?? "") ?? "We couldn't start your payment right now. Please try again in a minute.", 409);
  }
  const registration = data[0] as { registration_id: string; amount: number };
  const compactId = registration.registration_id.replace(/-/g, "");
  // Cashfree order IDs must be unique; deriving this from our UUID makes retries idempotent.
  const orderId = `femzy_${compactId}`;

  try {
    const order = await createCashfreeOrder({
      orderId,
      amount: Number(registration.amount),
      // Cashfree wants a plain phone number: drop spaces and dashes the form allows.
      customer: { id: `reg_${compactId}`, name: fullName, email, phone: phone.replace(/[\s-]/g, "") },
      idempotencyKey: registration.registration_id,
    });
    const { error: attachError } = await admin.rpc("attach_cashfree_order", { p_registration: registration.registration_id, p_order_id: order.orderId });
    if (attachError) {
      console.error("[cashfree] could not attach order", attachError.message);
      throw new SessionExpiredError();
    }
    return NextResponse.json({ registrationId: registration.registration_id, paymentSessionId: order.paymentSessionId, environment: env.cashfreeEnvironment });
  } catch (err) {
    console.error("[cashfree] order creation failed", err);
    // Free the held seat straight away instead of waiting for the 20-minute expiry.
    await admin.rpc("cancel_cashfree_registration", { p_registration: registration.registration_id, p_reason: "Payment could not start" });
    if (err instanceof SessionExpiredError) return bad("Your payment session expired. Please try again.", 409);
    return bad("We couldn't connect to the payment gateway. Please try again in a minute.", 502);
  }
}
