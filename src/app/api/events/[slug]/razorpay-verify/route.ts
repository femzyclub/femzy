import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env, isRazorpayConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await params; // Keeps this route scoped to an event URL.
  if (!isRazorpayConfigured) return bad("Online payments are not configured yet.", 503);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return bad("Registrations aren't connected yet.", 503);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const registrationId = String(body?.registrationId ?? "");
  const orderId = String(body?.razorpay_order_id ?? "");
  const paymentId = String(body?.razorpay_payment_id ?? "");
  const signature = String(body?.razorpay_signature ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(registrationId) || !/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !/^[a-f0-9]{64}$/i.test(signature)) return bad("Invalid payment response.");

  const expected = createHmac("sha256", env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest("hex");
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))) return bad("Payment verification failed.", 400);
  const { data, error } = await supabase.rpc("confirm_razorpay_event_registration", { p_registration: registrationId, p_order_id: orderId, p_payment_id: paymentId });
  if (error || !data?.[0]?.registration_code) return bad("We could not confirm this payment. Please contact Femzy with your payment ID.", 409);
  return NextResponse.json({ code: data[0].registration_code, status: "confirmed" });
}
