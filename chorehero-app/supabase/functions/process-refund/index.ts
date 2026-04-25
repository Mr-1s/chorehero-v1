/**
 * Process Refund - Stripe refund for cancelled bookings
 *
 * Called by bookingService.cancelBooking when refund_amount > 0.
 * Idempotent: Stripe refunds are idempotent by payment_intent + amount.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    // SECURITY (audit F-03): the previous handler accepted any
    // payment_intent_id with no auth, so anyone could refund anyone's PI.
    // Now we require either:
    //   - a valid JWT whose user_id == bookings.customer_id
    //   - OR an internal shared secret (used by `cancel_booking_with_refund`
    //     RPC paths invoked server-side)
    const authHeader = req.headers.get("Authorization") ?? "";
    const internalSecret = req.headers.get("x-internal-secret") ?? "";
    const expectedInternal = Deno.env.get("INTERNAL_SHARED_SECRET");
    const isInternal =
      !!expectedInternal && internalSecret && internalSecret === expectedInternal;

    const body = (await req.json()) as Body;
    const { payment_intent_id, amount_cents, booking_id } = body;

    if (!payment_intent_id || amount_cents <= 0 || !booking_id) {
      return new Response(
        JSON.stringify({ error: "Invalid payment_intent_id, amount_cents, or booking_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isInternal) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing auth" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await authClient.auth.getUser(token);
      if (!user?.id) {
        return new Response(
          JSON.stringify({ error: "Invalid auth" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      // Verify caller owns the booking AND that the PI matches it.
      const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: booking, error: bookingErr } = await admin
        .from("bookings")
        .select("id, customer_id, payment_intent_id, total_amount, status")
        .eq("id", booking_id)
        .single();
      if (bookingErr || !booking) {
        return new Response(
          JSON.stringify({ error: "Booking not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      if (booking.customer_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      if (booking.payment_intent_id && booking.payment_intent_id !== payment_intent_id) {
        return new Response(
          JSON.stringify({ error: "PI does not match booking" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      // Cap the refund at the booking's total to prevent over-refund attacks.
      const cap = Math.round(Number(booking.total_amount ?? 0) * 100);
      if (cap > 0 && amount_cents > cap) {
        return new Response(
          JSON.stringify({ error: "Refund amount exceeds booking total" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
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
    // SECURITY (audit F-19): log full error server-side, return generic to client.
    console.error("Process refund error:", e);
    return new Response(
      JSON.stringify({ error: "Refund failed" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});
