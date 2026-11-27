import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { finalizationHttp, verifyAndFinalizeCashfreeOrder } from "@/lib/cashfree-finalize";
import { isCashfreeConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await params;
  if (!isCashfreeConfigured) return bad("Online payments are not configured yet.", 503);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return bad("Registrations aren't connected yet.", 503);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const registrationId = String(body?.registrationId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(registrationId)) return bad("Invalid payment response.");

  const { data: registration, error: registrationError } = await supabase
    .from("event_registrations")
    .select("cashfree_order_id")
    .eq("id", registrationId)
    .eq("payment_provider", "cashfree")
    .maybeSingle();
  if (registrationError) console.error("[cashfree] registration lookup failed", registrationError.code, registrationError.message);
  if (registrationError || !registration?.cashfree_order_id) {
    return bad("We couldn't find this payment. If money was deducted, please contact the Femzy team with your payment details.", 404);
  }

  try {
    // Fetches the order and payments from Cashfree itself; nothing from the browser is trusted.
    const result = await verifyAndFinalizeCashfreeOrder(registration.cashfree_order_id, { client: supabase });
    if (result.state === "confirmed" || result.state === "cancelled") {
      revalidatePath("/events", "layout");
      revalidatePath("/");
    }
    const { status, body: responseBody } = finalizationHttp(result);
    return NextResponse.json(responseBody, { status });
  } catch (err) {
    console.error("[cashfree] verification failed", err);
    return bad("Payment verification failed. If you were charged, please wait a moment and try again.", 502);
  }
}
