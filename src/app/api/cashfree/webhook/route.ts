import { createHmac, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { verifyAndFinalizeCashfreeOrder } from "@/lib/cashfree-finalize";
import { env, isCashfreeConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CashfreeWebhook = {
  type?: string;
  data?: { order?: { order_id?: string } };
};

const HANDLED_EVENTS = new Set(["PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"]);

/**
 * Cashfree signs the exact raw body prefixed by the x-webhook-timestamp header.
 * The webhook is only a nudge: the payment is re-verified with Cashfree's API
 * before any registration changes, exactly like the browser return.
 */
export async function POST(request: Request) {
  if (!isCashfreeConfigured) return new NextResponse("Webhook is not configured", { status: 503 });
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const expected = createHmac("sha256", env.cashfreeSecretKey).update(`${timestamp}${rawBody}`).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (!timestamp || expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let event: CashfreeWebhook;
  try {
    event = JSON.parse(rawBody) as CashfreeWebhook;
  } catch {
    return new NextResponse("Invalid body", { status: 400 });
  }
  if (!event.type || !HANDLED_EVENTS.has(event.type)) return NextResponse.json({ ok: true });
  const orderId = event.data?.order?.order_id;
  if (!orderId || !/^[A-Za-z0-9_-]{3,45}$/.test(orderId)) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  if (!supabase) return new NextResponse("Server is not configured", { status: 503 });

  try {
    const result = await verifyAndFinalizeCashfreeOrder(orderId, { client: supabase });
    if (result.state === "confirmed" || result.state === "cancelled") {
      revalidatePath("/events", "layout");
      revalidatePath("/");
    }
    // confirmed / pending / cancelled / not_found / refund_required are all final answers for this delivery.
    return NextResponse.json({ ok: true, state: result.state });
  } catch (err) {
    console.error("[cashfree] webhook processing failed", err);
    // Non-2xx makes Cashfree retry the webhook later.
    return new NextResponse("Processing failed", { status: 500 });
  }
}
