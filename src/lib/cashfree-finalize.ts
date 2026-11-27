import "server-only";
import { createCashfreeRefund, verifyCashfreeOrder, type CashfreeOrderVerification } from "@/lib/cashfree";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type ConfirmErrorCode =
  | "PAYMENT_AMOUNT_MISMATCH"
  | "LATE_PAYMENT_NO_SEAT"
  | "LATE_PAYMENT_DUPLICATE"
  | "PAYMENT_ORDER_MISMATCH"
  | "ALREADY_CONFIRMED_WITH_DIFFERENT_PAYMENT"
  | "PAYMENT_NOT_FOUND"
  | "INVALID_ORDER_ID"
  | "INVALID_PAYMENT_ID"
  | "INVALID_PAYMENT_AMOUNT";

export type CashfreeFinalization =
  | { state: "confirmed"; code: string }
  | { state: "pending" }
  | { state: "cancelled" }
  | { state: "not_found" }
  | { state: "refund_required"; refundStarted: boolean; reason: ConfirmErrorCode | "UNKNOWN" };

const DB_FAILURE_CODES = new Set<ConfirmErrorCode>([
  "PAYMENT_AMOUNT_MISMATCH",
  "LATE_PAYMENT_NO_SEAT",
  "LATE_PAYMENT_DUPLICATE",
  "PAYMENT_ORDER_MISMATCH",
  "ALREADY_CONFIRMED_WITH_DIFFERENT_PAYMENT",
  "PAYMENT_NOT_FOUND",
  "INVALID_ORDER_ID",
  "INVALID_PAYMENT_ID",
  "INVALID_PAYMENT_AMOUNT",
]);

function databaseErrorCode(error: { message?: string } | null): ConfirmErrorCode | "UNKNOWN" {
  const code = error?.message?.split(":")[0]?.trim() ?? "";
  return DB_FAILURE_CODES.has(code as ConfirmErrorCode) ? (code as ConfirmErrorCode) : "UNKNOWN";
}

async function writeRefundReviewLog(client: AdminClient, details: Record<string, unknown>) {
  const { error } = await client.from("admin_logs").insert({
    admin_id: null,
    action: "Cashfree payment needs refund review",
    details,
  });
  if (error) console.error("[cashfree] could not write refund review log", error.message);
}

async function refundAndLog({ client, registrationId, orderId, paymentId, refundAmount, reason }: {
  client: AdminClient;
  registrationId: string;
  orderId: string;
  paymentId: string;
  refundAmount: number;
  reason: ConfirmErrorCode | "UNKNOWN";
}) {
  try {
    const refund = await createCashfreeRefund({ orderId, amount: refundAmount, reason: "Registration could not be confirmed" });
    await writeRefundReviewLog(client, { registration_id: registrationId, order_id: orderId, payment_id: paymentId, reason, refund_started: true, refund_id: refund.refundId, cashfree_refund_id: refund.cashfreeRefundId, refund_status: refund.status });
    return true;
  } catch (error) {
    console.error("[cashfree] automatic refund failed", error);
    await writeRefundReviewLog(client, { registration_id: registrationId, order_id: orderId, payment_id: paymentId, reason, refund_started: false });
    return false;
  }
}

/**
 * Single source of truth for browser returns and webhooks. It fetches the order
 * and payments from Cashfree before mutating any registration state.
 */
export async function verifyAndFinalizeCashfreeOrder(orderId: string, dependencies?: {
  client?: AdminClient;
  verifyOrder?: (id: string) => Promise<CashfreeOrderVerification>;
}) : Promise<CashfreeFinalization> {
  const client = dependencies?.client ?? createSupabaseAdminClient();
  if (!client) throw new Error("The service-role database client is not configured.");
  const { data: registration, error: lookupError } = await client
    .from("event_registrations")
    .select("id")
    .eq("cashfree_order_id", orderId)
    .eq("payment_provider", "cashfree")
    .maybeSingle();
  if (lookupError) throw new Error(`Could not find the payment registration: ${lookupError.message}`);
  if (!registration) return { state: "not_found" };

  const verification = await (dependencies?.verifyOrder ?? verifyCashfreeOrder)(orderId);
  if (verification.state === "pending") return { state: "pending" };
  if (verification.state === "terminal_failure") {
    const { error } = await client.rpc("cancel_cashfree_registration", {
      p_registration: registration.id,
      p_reason: `Cashfree payment ${verification.reason.toLowerCase().replace(/_/g, " ")}`,
    });
    if (error) throw new Error("Could not release the payment reservation.");
    return { state: "cancelled" };
  }

  const { data, error } = await client.rpc("confirm_cashfree_event_registration", {
    p_registration: registration.id,
    p_order_id: verification.orderId,
    p_payment_id: verification.paymentId,
    // Compare Cashfree's order amount to events.fee. payment_amount can include a surcharge.
    p_order_amount: verification.orderAmount,
  });
  if (!error && data?.[0]?.registration_code) return { state: "confirmed", code: data[0].registration_code };

  const reason = databaseErrorCode(error);
  // An unknown error (network, permissions, timeout) is not proof the seat is gone.
  // Throw so the webhook/browser retries instead of refunding a valid payment.
  if (reason === "UNKNOWN") throw new Error(`Could not confirm the Cashfree payment: ${error?.message ?? "no registration code returned"}`);
  const refundStarted = await refundAndLog({
    client,
    registrationId: registration.id,
    orderId: verification.orderId,
    paymentId: verification.paymentId,
    refundAmount: verification.paymentAmount,
    reason,
  });
  return { state: "refund_required", refundStarted, reason };
}

export function finalizationHttp(result: CashfreeFinalization) {
  switch (result.state) {
    case "confirmed":
      return { status: 200, body: { code: result.code, status: "confirmed" } };
    case "pending":
      return { status: 409, body: { error: "Your payment is still being confirmed. Please wait a moment and try again." } };
    case "cancelled":
      return { status: 409, body: { error: "The payment was not completed. You can try again now." } };
    case "not_found":
      return { status: 404, body: { error: "We couldn't find this payment. If money was deducted, please contact the Femzy team with your payment details." } };
    case "refund_required":
      return { status: 409, body: { error: result.refundStarted ? "Payment was received but your place could not be confirmed. A refund has been started." : "Payment was received but your place could not be confirmed. Our team has been alerted to arrange a refund." } };
  }
}
