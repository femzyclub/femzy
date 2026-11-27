import "server-only";
import { createHash } from "crypto";
import { env, isCashfreeConfigured } from "@/lib/env";

// Cashfree's current Payment Gateway API version (v6) as of 2026-11-27.
const API_VERSION = "2026-01-01";
const ORDER_ID = /^[A-Za-z0-9_-]{3,45}$/;

type CashfreeError = { message?: string; code?: string; type?: string };
type CashfreeOrder = {
  order_id?: string;
  payment_session_id?: string;
  order_status?: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED";
  order_amount?: number;
  order_currency?: string;
} & CashfreeError;
type CashfreePayment = {
  cf_payment_id?: string;
  order_id?: string;
  order_amount?: number;
  payment_amount?: number;
  payment_status?: "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING";
};
type CashfreeRefund = { refund_id?: string; cf_refund_id?: string; refund_status?: string } & CashfreeError;

export type CashfreeOrderVerification =
  | { state: "paid"; orderId: string; paymentId: string; orderAmount: number; paymentAmount: number }
  | { state: "terminal_failure"; reason: "EXPIRED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" }
  | { state: "pending" };

function apiBaseUrl() {
  return env.cashfreeEnvironment === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

function headers(idempotencyKey?: string) {
  return {
    "x-client-id": env.cashfreeAppId,
    "x-client-secret": env.cashfreeSecretKey,
    "x-api-version": API_VERSION,
    Accept: "application/json",
    ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
  };
}

function requireOrderId(orderId: string) {
  if (!ORDER_ID.test(orderId)) throw new Error("Invalid Cashfree order ID.");
}

async function responseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

export async function createCashfreeOrder({ orderId, amount, customer, idempotencyKey }: {
  orderId: string;
  amount: number;
  customer: { id: string; name: string; email: string; phone: string };
  idempotencyKey: string;
}) {
  if (!isCashfreeConfigured) throw new Error("Cashfree is not configured.");
  requireOrderId(orderId);
  const response = await fetch(`${apiBaseUrl()}/orders`, {
    method: "POST",
    headers: { ...headers(idempotencyKey), "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      order_expiry_time: new Date(Date.now() + 19 * 60 * 1000).toISOString(),
      customer_details: {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
      },
      order_meta: {
        return_url: `${env.siteUrl}/events/payment-return?order_id={order_id}`,
        notify_url: `${env.siteUrl}/api/cashfree/webhook`,
      },
    }),
    cache: "no-store",
  });
  const body = await responseJson<CashfreeOrder>(response);
  if (!response.ok || !body.order_id || !body.payment_session_id) throw new Error(body.message || "Cashfree could not create the payment order.");
  return { orderId: body.order_id, paymentSessionId: body.payment_session_id };
}

/** Verifies all payment facts with Cashfree; browser and webhook values are never trusted. */
export async function verifyCashfreeOrder(orderId: string): Promise<CashfreeOrderVerification> {
  if (!isCashfreeConfigured) throw new Error("Cashfree is not configured.");
  requireOrderId(orderId);
  const orderResponse = await fetch(`${apiBaseUrl()}/orders/${encodeURIComponent(orderId)}`, { headers: headers(), cache: "no-store" });
  const order = await responseJson<CashfreeOrder>(orderResponse);
  if (!orderResponse.ok) throw new Error(order.message || "Cashfree could not verify the payment.");
  if (order.order_id !== orderId || order.order_currency !== "INR" || typeof order.order_amount !== "number") throw new Error("Cashfree returned an invalid order response.");
  if (order.order_status === "EXPIRED") return { state: "terminal_failure", reason: "EXPIRED" };
  if (order.order_status !== "PAID") return { state: "pending" };

  const paymentsResponse = await fetch(`${apiBaseUrl()}/orders/${encodeURIComponent(orderId)}/payments`, { headers: headers(), cache: "no-store" });
  const payments = await responseJson<CashfreePayment[]>(paymentsResponse);
  if (!paymentsResponse.ok || !Array.isArray(payments)) throw new Error("Cashfree could not retrieve the payment details.");
  const success = payments.find((item) => item.order_id === orderId && item.payment_status === "SUCCESS" && item.cf_payment_id && typeof item.order_amount === "number" && typeof item.payment_amount === "number");
  if (success) return { state: "paid", orderId, paymentId: success.cf_payment_id!, orderAmount: success.order_amount!, paymentAmount: success.payment_amount! };
  const terminalStatuses = ["FAILED", "USER_DROPPED", "VOID", "CANCELLED"] as const;
  type TerminalStatus = (typeof terminalStatuses)[number];
  const terminal = payments.find((item) => terminalStatuses.includes(item.payment_status as TerminalStatus));
  if (terminal?.payment_status) return { state: "terminal_failure", reason: terminal.payment_status as TerminalStatus };
  throw new Error("Cashfree marked the order paid without a successful payment.");
}

export async function createCashfreeRefund({ orderId, amount, reason }: { orderId: string; amount: number; reason: string }) {
  if (!isCashfreeConfigured) throw new Error("Cashfree is not configured.");
  requireOrderId(orderId);
  const refundId = `rf${orderId.replace(/[^A-Za-z0-9]/g, "").slice(-38)}`;
  const digest = createHash("sha256").update(`refund:${orderId}`).digest("hex");
  const idempotencyKey = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
  const response = await fetch(`${apiBaseUrl()}/orders/${encodeURIComponent(orderId)}/refunds`, {
    method: "POST",
    headers: { ...headers(idempotencyKey), "Content-Type": "application/json" },
    body: JSON.stringify({ refund_amount: amount, refund_id: refundId, refund_note: reason.slice(0, 100), refund_speed: "STANDARD" }),
    cache: "no-store",
  });
  const body = await responseJson<CashfreeRefund>(response);
  if (!response.ok || !body.refund_id) throw new Error(body.message || "Cashfree could not start the refund.");
  return { refundId: body.refund_id, cashfreeRefundId: body.cf_refund_id ?? null, status: body.refund_status ?? "PENDING" };
}
