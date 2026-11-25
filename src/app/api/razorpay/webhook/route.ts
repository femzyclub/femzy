import { createHmac, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RazorpayWebhook = {
  event?: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
};

/** Razorpay's server-to-server backup confirmation for a successful checkout. */
export async function POST(request: Request) {
  if (!env.razorpayWebhookSecret) return new NextResponse("Webhook is not configured", { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(signature) || !timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody) as RazorpayWebhook;
  if (event.event !== "payment.captured" && event.event !== "order.paid") return NextResponse.json({ ok: true });
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) return new NextResponse("Missing payment details", { status: 400 });

  const supabase = createSupabaseAdminClient();
  if (!supabase) return new NextResponse("Server is not configured", { status: 503 });
  const { data: registration } = await supabase.from("event_registrations").select("id, event_id").eq("razorpay_order_id", payment.order_id).maybeSingle();
  if (!registration) return NextResponse.json({ ok: true }); // Not an event order, or already removed.
  const { error } = await supabase.rpc("confirm_razorpay_event_registration", {
    p_registration: registration.id,
    p_order_id: payment.order_id,
    p_payment_id: payment.id,
  });
  // The checkout handler may already have confirmed it; Razorpay retries webhooks, so treat that as successful.
  if (error && !/PAYMENT_NOT_FOUND/.test(error.message)) return new NextResponse(error.message, { status: 500 });
  revalidatePath("/events", "layout");
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
