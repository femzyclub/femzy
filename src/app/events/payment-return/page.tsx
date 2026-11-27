import Link from "next/link";
import { verifyAndFinalizeCashfreeOrder, type CashfreeFinalization } from "@/lib/cashfree-finalize";
import { isCashfreeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Cashfree sends a shopper here after a bank or UPI redirect. The order_id in
 * the URL is only used to look the payment up; it is verified with Cashfree's
 * API before anything is confirmed.
 */
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ order_id?: string | string[] }> }) {
  const { order_id } = await searchParams;
  const orderId = typeof order_id === "string" ? order_id : "";

  let result: CashfreeFinalization | null = null;
  if (isCashfreeConfigured() && /^[A-Za-z0-9_-]{3,45}$/.test(orderId)) {
    try {
      result = await verifyAndFinalizeCashfreeOrder(orderId);
    } catch (err) {
      console.error("[cashfree] return-page verification failed", err);
    }
  }

  let title = "We're confirming your payment.";
  let message = "Cashfree has returned you safely. Your registration is confirmed only after we verify the payment; this usually takes a moment.";
  if (result?.state === "confirmed") {
    title = "You're in!";
    message = `Your payment is verified and your place is confirmed. Your registration ID is ${result.code}. Keep it handy for the event.`;
  } else if (result?.state === "cancelled") {
    title = "Payment not completed.";
    message = "The payment didn't go through, so nothing was charged for this registration. You can try registering again.";
  } else if (result?.state === "refund_required") {
    title = "Payment received, place not confirmed.";
    message = result.refundStarted
      ? "We received your payment but couldn't confirm your place (the event may have filled up). A refund has been started."
      : "We received your payment but couldn't confirm your place. Our team has been alerted and will arrange a refund.";
  }

  return (
    <main className="container-x py-24 sm:py-32">
      <section className="card-pop mx-auto max-w-xl bg-white p-8 text-center sm:p-12">
        <span className="eyebrow">Payment update</span>
        <h1 className="h-display mt-4 text-4xl sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] text-fr-charcoal">{message}</p>
        <Link href="/events" className="btn-primary mt-7">Browse events</Link>
      </section>
    </main>
  );
}
