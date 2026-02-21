/**
 * Process Refund - Stripe refund for cancelled bookings
 *
 * Called by bookingService.cancelBooking when refund_amount > 0.
 * Idempotent: Stripe refunds are idempotent by payment_intent + amount.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@15.12.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

interface Body {
  payment_intent_id: string;
  amount_cents: number;
  booking_id: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = (await req.json()) as Body;
    const { payment_intent_id, amount_cents, booking_id } = body;

    if (!payment_intent_id || amount_cents <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid payment_intent_id or amount_cents" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment_intent_id,
      amount: amount_cents,
      reason: "requested_by_customer",
      metadata: { booking_id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refund.id,
        status: refund.status,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const e = err as Error;
    console.error("Process refund error:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "Refund failed" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});
