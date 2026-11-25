import "server-only";
import { env, isRazorpayConfigured } from "@/lib/env";

type RazorpayOrder = { id: string; amount: number; currency: string };

export async function createRazorpayOrder({ amount, receipt, notes }: { amount: number; receipt: string; notes: Record<string, string> }) {
  if (!isRazorpayConfigured) throw new Error("Razorpay is not configured.");
  const credentials = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amount * 100, currency: "INR", receipt, notes }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as RazorpayOrder & { error?: { description?: string } };
  if (!response.ok || !body.id) throw new Error(body.error?.description || "Razorpay could not create the payment order.");
  return body;
}
