import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const PLATFORM_FEE_BPS = Number(Deno.env.get("STRIPE_PLATFORM_FEE_BPS") ?? "1900");
const CUSTOMER_FEE_BPS = Number(Deno.env.get("STRIPE_CUSTOMER_FEE_BPS") ?? "900");

function roundCents(n: number) {
  return Math.max(0, Math.round(n));
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. VERIFY JWT - CRITICAL
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } =
      await authClient.auth.getUser(token);
    const userId = user?.id;
    if (authError || !userId) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 3. PARSE BODY - ONLY EXPECT bookingId
    const body = await req.json();
    const bookingId = body?.bookingId;
    if (!bookingId || typeof bookingId !== "string") {
      return new Response(JSON.stringify({ error: "bookingId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. FETCH BOOKING - VERIFY USER OWNS IT (customer must pay)
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select(
        "id, customer_id, cleaner_id, total_amount, service_base_price, add_ons_total, platform_fee, tax, tip, payment_status, status"
      )
      .eq("id", bookingId)
      .eq("customer_id", userId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. VERIFY BOOKING STATUS - only pay if pending/captured not yet
    if (
      booking.payment_status === "succeeded" ||
      booking.payment_status === "paid" ||
      booking.payment_status === "captured"
    ) {
      return new Response(JSON.stringify({ error: "Booking already paid" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 6. GET CLEANER'S STRIPE ACCOUNT - server-side only
    if (!booking.cleaner_id) {
      return new Response(JSON.stringify({ error: "Booking has no cleaner" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: cleanerProfile } = await supabaseClient
      .from("cleaner_profiles")
      .select("stripe_account_id")
      .eq("user_id", booking.cleaner_id)
      .single();

    const cleanerAccountId = cleanerProfile?.stripe_account_id;
    if (!cleanerAccountId) {
      return new Response(
        JSON.stringify({ error: "Cleaner has no payment account" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 7. CALCULATE AMOUNT SERVER-SIDE - NEVER TRUST CLIENT
    const totalAmount = Number(booking.total_amount) || 0;
    const amount = roundCents(totalAmount * 100);
    const feeBase = amount;
    const platformFeeCents = roundCents((PLATFORM_FEE_BPS / 10000) * feeBase);
    const customerFeeCents = roundCents((CUSTOMER_FEE_BPS / 10000) * feeBase);

    if (amount < 50) {
      return new Response(
        JSON.stringify({ error: "Amount too small (min $0.50)" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 8. CREATE PAYMENT INTENT
    const idemKey = `booking:${bookingId}`;
    const pi = await stripe.paymentIntents.create(
      {
        amount,
        currency: "usd",
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: cleanerAccountId },
        automatic_payment_methods: { enabled: true },
        metadata: {
          booking_id: bookingId,
          customer_id: userId,
          cleaner_id: booking.cleaner_id,
          fee_base_cents: String(feeBase),
          customer_fee_cents: String(customerFeeCents),
          platform_fee_cents: String(platformFeeCents),
        },
      },
      { idempotencyKey: idemKey }
    );

    return new Response(
      JSON.stringify({
        clientSecret: pi.client_secret,
        amount_cents: amount,
        customer_fee_cents: customerFeeCents,
        platform_fee_cents: platformFeeCents,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    console.error(err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "stripe_error",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
