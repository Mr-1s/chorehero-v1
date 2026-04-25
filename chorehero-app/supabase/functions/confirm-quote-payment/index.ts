/**
 * Confirm quote payment - create booking after Stripe payment succeeds.
 * Called from client after Stripe payment sheet completes.
 * verify_jwt=false: gateway bypass; we validate via Stripe payment_intent instead.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

const PLATFORM_FEE_PCT = 0.20;

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

    // SECURITY (audit F-02): the previous handler had `verify_jwt = false`
    // and only checked PI status + optional metadata. A caller with any
    // succeeded PI ID and a quote_id could create a booking. Require a JWT
    // and bind the call to the customer who owns the underlying job.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await req.json();
    const quoteId = body?.quote_id;
    const paymentIntentId = body?.payment_intent_id;

    console.log("Confirming payment:", { quote_id: quoteId, payment_intent_id: paymentIntentId });

    if (!quoteId || typeof quoteId !== "string") {
      return new Response(JSON.stringify({ error: "quote_id required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return new Response(JSON.stringify({ error: "payment_intent_id required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!stripe) {
      return new Response(
        JSON.stringify({
          error: "Stripe not configured. Set STRIPE_SECRET_KEY in Edge Function secrets.",
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await authClient.auth.getUser(token);
    const callerId = user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch quote
    const { data: quote, error: quoteError } = await supabaseClient
      .from("quotes")
      .select("id, job_id, pro_id, price_cents, status")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      console.error("Quote not found:", quoteError);
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Fetch job with headline for notification
    const { data: job, error: jobError } = await supabaseClient
      .from("jobs")
      .select("id, customer_id, street, city, state, zip_code, address_id, headline")
      .eq("id", quote.job_id)
      .single();

    if (jobError || !job) {
      console.error("Job not found:", jobError);
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

    // Verify payment intent with Stripe
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log("Payment intent status:", pi.status);

    if (pi.status !== "succeeded") {
      return new Response(
        JSON.stringify({ error: `Payment not successful: ${pi.status}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // SECURITY (audit F-02): tighten PI binding so a caller can't reuse a
    // succeeded PI from a different quote/customer.
    const metaQuoteId = pi.metadata?.quote_id;
    if (metaQuoteId && metaQuoteId !== quoteId) {
      return new Response(JSON.stringify({ error: "Payment does not match quote" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    const metaCustomerId = pi.metadata?.customer_id;
    if (metaCustomerId && metaCustomerId !== job.customer_id) {
      return new Response(JSON.stringify({ error: "Payment does not match customer" }), {
        status: 403,
        headers: corsHeaders,
      });
    }
    // Amount sanity check — within 1 cent tolerance.
    const expectedAmount = Number(quote.price_cents) || 0;
    if (expectedAmount > 0 && Math.abs((pi.amount_received ?? pi.amount) - expectedAmount) > 1) {
      return new Response(
        JSON.stringify({ error: "Payment amount does not match quote" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Resolve address_id
    let addressId = job.address_id;
    if (!addressId && (job.street || job.city || job.zip_code)) {
      const { data: newAddr, error: addrErr } = await supabaseClient
        .from("addresses")
        .insert({
          user_id: job.customer_id,
          street: job.street || "Address",
          city: job.city || "City",
          state: job.state || "State",
          zip_code: job.zip_code || "00000",
          is_default: false,
        })
        .select("id")
        .single();
      if (!addrErr && newAddr) addressId = newAddr.id;
    }
    if (!addressId) {
      // Create minimal placeholder address if job has none
      const { data: placeholderAddr, error: placeErr } = await supabaseClient
        .from("addresses")
        .insert({
          user_id: job.customer_id,
          street: "Job address",
          city: "City",
          state: "State",
          zip_code: "00000",
          is_default: false,
        })
        .select("id")
        .single();
      if (!placeErr && placeholderAddr) addressId = placeholderAddr.id;
    }
    if (!addressId) {
      return new Response(JSON.stringify({ error: "Could not resolve address" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const amountCents = Number(quote.price_cents) || 0;
    const totalAmount = amountCents / 100;
    const platformFee = totalAmount * PLATFORM_FEE_PCT;
    const serviceSubtotal = totalAmount - platformFee;
    const cleanerEarnings = serviceSubtotal;

    const scheduledTime = new Date();
    scheduledTime.setDate(scheduledTime.getDate() + 1);
    scheduledTime.setHours(10, 0, 0, 0);

    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .insert({
        customer_id: job.customer_id,
        cleaner_id: quote.pro_id,
        quote_id: quoteId,
        job_id: quote.job_id,
        service_type: "standard",
        status: "confirmed",
        address_id: addressId,
        scheduled_time: scheduledTime.toISOString(),
        estimated_duration: 120,
        service_base_price: serviceSubtotal,
        platform_fee: platformFee,
        add_ons_total: 0,
        tax: 0,
        tip: 0,
        total_amount: totalAmount,
        cleaner_earnings: cleanerEarnings,
        stripe_payment_intent_id: paymentIntentId,
        payment_status: "succeeded",
        special_instructions: "Booked from your quote",
        messaging_enabled: true,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("Booking creation error:", bookingError);
      return new Response(
        JSON.stringify({
          error: "Failed to create booking",
          details: bookingError?.message || "Unknown error",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    await supabaseClient.from("quotes").update({ status: "accepted" }).eq("id", quoteId);

    await supabaseClient
      .from("jobs")
      .update({ status: "booked", booked_at: new Date().toISOString() })
      .eq("id", quote.job_id);

    await supabaseClient
      .from("quotes")
      .update({ status: "declined" })
      .eq("job_id", quote.job_id)
      .neq("id", quoteId);

    // Fetch customer name for notification
    let customerName = "A customer";
    const { data: customer } = await supabaseClient
      .from("users")
      .select("name")
      .eq("id", job.customer_id)
      .single();
    if (customer?.name) customerName = customer.name;

    const serviceName = (job as { headline?: string }).headline || "Service";
    const dateStr = scheduledTime.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const notificationBody = `New booking! ${customerName} booked your ${serviceName} for ${dateStr}. You earn $${cleanerEarnings.toFixed(2)}`;

    try {
      await supabaseClient.functions.invoke("send-push", {
        body: {
          userId: quote.pro_id,
          title: "New booking!",
          body: notificationBody,
          badge: 1,
          data: { booking_id: booking.id, job_id: quote.job_id, type: "quote_accepted" },
        },
      });
    } catch {
      // Non-blocking
    }

    console.log("Booking created:", booking.id);

    return new Response(
      JSON.stringify({ success: true, booking_id: booking.id }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: unknown) {
    // SECURITY (audit F-10): never leak stack traces or internal error
    // messages to the client. Log full detail server-side, return generic.
    console.error("Confirm payment error:", err);
    return new Response(
      JSON.stringify({ error: "Could not confirm payment. Please try again." }),
      { status: 500, headers: corsHeaders }
    );
  }
});
