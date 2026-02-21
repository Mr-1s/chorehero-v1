/**
 * Process Payout Queue - Stripe Connect transfers to cleaners
 *
 * Runs via Supabase Cron (hourly) or external cron hitting this endpoint.
 * Processes pending payouts where scheduled_at <= NOW().
 *
 * Cron: select cron.schedule('process-payouts', '0 * * * *', $$select net.http_post(...)$$);
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@15.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Optional: require cron secret for security
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const startTime = Date.now();

  try {
    const { data: payouts, error: fetchError } = await supabase
      .from("payout_queue")
      .select(`
        id,
        booking_id,
        cleaner_id,
        amount_cents,
        status
      `)
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(100);

    if (fetchError) {
      console.error("Error fetching payout queue:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failedCount = 0;
    const results: { id: string; status: string; error?: string }[] = [];

    for (const payout of payouts || []) {
      // Get cleaner's Stripe Connect account
      const { data: profile, error: profileError } = await supabase
        .from("cleaner_profiles")
        .select("stripe_account_id")
        .eq("user_id", payout.cleaner_id)
        .single();

      if (profileError || !profile?.stripe_account_id) {
        await supabase
          .from("payout_queue")
          .update({
            status: "failed",
            error_message: "Cleaner has no Stripe Connect account",
            processed_at: new Date().toISOString(),
          })
          .eq("id", payout.id);
        failedCount++;
        results.push({
          id: payout.id,
          status: "failed",
          error: "No stripe_account_id",
        });
        continue;
      }

      // Check Stripe Connect account is fully onboarded before transfer
      try {
        const account = await stripe.accounts.retrieve(profile.stripe_account_id);
        if (!account.charges_enabled || !account.payouts_enabled) {
          await supabase
            .from("payout_queue")
            .update({
              status: "failed",
              error_message: "Cleaner Stripe account not fully onboarded (complete KYC/bank setup)",
              processed_at: new Date().toISOString(),
            })
            .eq("id", payout.id);
          failedCount++;
          results.push({
            id: payout.id,
            status: "failed",
            error: "Stripe account not ready",
          });
          continue;
        }
      } catch (accountErr) {
        await supabase
          .from("payout_queue")
          .update({
            status: "failed",
            error_message: (accountErr as Error)?.message ?? "Could not verify Stripe account",
            processed_at: new Date().toISOString(),
          })
          .eq("id", payout.id);
        failedCount++;
        results.push({
          id: payout.id,
          status: "failed",
          error: "Stripe account check failed",
        });
        continue;
      }

      try {
        const transfer = await stripe.transfers.create({
          amount: payout.amount_cents,
          currency: "usd",
          destination: profile.stripe_account_id,
          transfer_group: payout.booking_id,
          metadata: { booking_id: payout.booking_id },
        });

        await supabase
          .from("payout_queue")
          .update({
            status: "completed",
            stripe_transfer_id: transfer.id,
            processed_at: new Date().toISOString(),
          })
          .eq("id", payout.id);

        processed++;
        results.push({ id: payout.id, status: "completed" });
      } catch (stripeError: unknown) {
        const err = stripeError as Error;
        await supabase
          .from("payout_queue")
          .update({
            status: "failed",
            error_message: err?.message ?? "Stripe transfer failed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", payout.id);
        failedCount++;
        results.push({ id: payout.id, status: "failed", error: err?.message });
      }
    }

    // Cron monitoring: log run for alerting (alert if no log in 2+ hours)
    const { error: logError } = await supabase.from("cron_logs").insert({
      function_name: "process-payouts",
      processed_count: processed,
      failed_count: failedCount,
      duration_ms: Date.now() - startTime,
      ran_at: new Date().toISOString(),
      metadata: { total: payouts?.length ?? 0, results },
    });
    if (logError) console.warn("Cron log insert failed (run migration 027):", logError);

    return new Response(
      JSON.stringify({
        processed,
        failed: failedCount,
        total: payouts?.length ?? 0,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Process payouts error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
