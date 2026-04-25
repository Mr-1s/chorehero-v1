/**
 * Create Payment Intent for quote acceptance (payment-first flow).
 * Funds are captured to platform; pro is paid 48h after job completion via process-payouts.
 * 20% platform fee, 80% pro payout.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set; DB access may fail");
}

const PLATFORM_FEE_PCT = 0.20; // 20%

function roundCents(n: number) {
  return Math.max(0, Math.round(n));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    // SECURITY (audit F-01): the previous handler intentionally bypassed JWT
    // verification while debugging a 401, which let any caller create a
    // PaymentIntent for any quote_id and obtain a clientSecret. Re-enable
    // auth and verify the caller is the customer who owns the underlying job.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing auth" }),
        { status: 401, headers: corsHeaders }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await authClient.auth.getUser(token);
    const callerId = user?.id;
    if (!callerId) {
      return new Response(
        JSON.stringify({ error: "Invalid auth" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const quoteId = body?.quote_id;
    if (!quoteId || typeof quoteId !== "string") {
      return new Response(JSON.stringify({ error: "quote_id required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Fetch quote
    const { data: quote, error: quoteError } = await supabaseClient
      .from("quotes")
      .select("id, job_id, pro_id, price_cents, status")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (quote.status !== "pending" && quote.status !== "viewed") {
      return new Response(JSON.stringify({ error: "Quote no longer available" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: job, error: jobError } = await supabaseClient
      .from("jobs")
      .select("id, customer_id, status")
      .eq("id", quote.job_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (job.customer_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    if (job.status !== "open" && job.status !== "quotes_received") {
      return new Response(JSON.stringify({ error: "Job no longer available" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const amountCents = Number(quote.price_cents) || 0;
    const platformFeeCents = roundCents(amountCents * PLATFORM_FEE_PCT);
    const proPayoutCents = amountCents - platformFeeCents;

    if (amountCents < 50) {
      return new Response(
        JSON.stringify({ error: "Amount too small (min $0.50)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!stripe) {
      return new Response(
        JSON.stringify({
          error:
            "Stripe not configured. Set STRIPE_SECRET_KEY in Edge Function secrets.",
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    // Create PaymentIntent - NO transfer_data (funds stay on platform until payout)
    const idemKey = `quote:${quoteId}`;
    const pi = await stripe!.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          quote_id: quoteId,
          job_id: quote.job_id,
          pro_id: quote.pro_id,
          customer_id: job.customer_id,
          platform_fee_cents: String(platformFeeCents),
          pro_payout_cents: String(proPayoutCents),
        },
      },
      { idempotencyKey: idemKey }
    );

    return new Response(
      JSON.stringify({
        clientSecret: pi.client_secret,
        client_secret: pi.client_secret,
        payment_intent_id: pi.id,
        amount_cents: amountCents,
        platform_fee_cents: platformFeeCents,
        pro_payout_cents: proPayoutCents,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "stripe_error";
    console.error("Edge Function error:", err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: corsHeaders }
    );
  }
});
