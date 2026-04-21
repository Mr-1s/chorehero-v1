import { serve } from "https://deno.land/std/http/server.ts";
import Stripe from "https://esm.sh/stripe@15.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const sig = req.headers.get("stripe-signature")!;
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const bookingId = pi.metadata?.booking_id;

      if (bookingId) {
        // Idempotency: Only process if not already captured (handles duplicate webhooks)
        const { data: booking } = await supabase
          .from("bookings")
          .select("payment_status, stripe_payment_intent_id, messaging_enabled, status")
          .eq("id", bookingId)
          .single();

        const alreadyPaid =
          booking?.payment_status === "captured" ||
          booking?.payment_status === "paid" ||
          booking?.payment_status === "succeeded" ||
          booking?.stripe_payment_intent_id === pi.id;

        if (alreadyPaid) {
          // Backfill messaging_enabled for rows paid before this unlock existed
          if (booking && !booking.messaging_enabled) {
            await supabase
              .from("bookings")
              .update({
                messaging_enabled: true,
                updated_at: new Date().toISOString(),
              })
              .eq("id", bookingId);
            console.log(`✅ Booking ${bookingId} messaging_enabled backfilled`);
          }
          console.log(`⏭️ Booking ${bookingId} already processed, skipping payment updates`);
          break;
        }

        // Use RPC for atomic capture (or direct update if RPC expects different states)
        const { data: captured } = await supabase.rpc("capture_booking_payment", {
          p_booking_id: bookingId,
          p_payment_intent_id: pi.id,
        });

        if (!captured) {
          // RPC may not match (e.g. payment_status not in authorized/pending) — fallback to direct update
          const statusBump =
            booking?.status === "pending" ? ({ status: "confirmed" as const } as const) : {};
          const { error } = await supabase
            .from("bookings")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: pi.id,
              messaging_enabled: true,
              ...statusBump,
              updated_at: new Date().toISOString(),
            })
            .eq("id", bookingId);

          if (error) {
            console.error("Error updating booking:", error);
          } else {
            console.log(`✅ Booking ${bookingId} marked as paid, messaging unlocked`);
          }
        } else {
          const statusBump =
            booking?.status === "pending" ? ({ status: "confirmed" as const } as const) : {};
          await supabase
            .from("bookings")
            .update({
              messaging_enabled: true,
              ...statusBump,
              updated_at: new Date().toISOString(),
            })
            .eq("id", bookingId);
          console.log(`✅ Booking ${bookingId} captured via RPC, messaging unlocked`);
        }

        // Create payment record (idempotent by booking_id + pi.id if unique)
        await supabase.from("payments").insert({
          booking_id: bookingId,
          stripe_payment_intent_id: pi.id,
          amount: pi.amount,
          platform_fee: parseInt(pi.metadata?.platform_fee_cents || "0"),
          status: "succeeded",
          created_at: new Date().toISOString(),
        });
      }
      break;
    }
    
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const bookingId = pi.metadata?.booking_id;
      
      if (bookingId) {
        await supabase
          .from('bookings')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId);
        
        console.log(`❌ Payment failed for booking ${bookingId}`);
      }
      break;
    }
    
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      
      // Update cleaner's Stripe Connect status
      const { error } = await supabase
        .from('stripe_connect_accounts')
        .update({
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', account.id);
      
      if (error) {
        console.error('Error updating Connect account:', error);
      } else {
        console.log(`✅ Connect account ${account.id} updated`);
      }
      break;
    }
    
    case "transfer.created": {
      const transfer = event.data.object as Stripe.Transfer;
      console.log(`💸 Transfer created: ${transfer.id} - $${transfer.amount / 100}`);
      // Instant payout to cleaner recorded
      break;
    }
  }

  return new Response("ok", { status: 200 });
});
