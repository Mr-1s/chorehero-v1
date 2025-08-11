import { serve } from "https://deno.land/std/http/server.ts";
import Stripe from "https://esm.sh/stripe?target=deno";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

interface Body {
  bookingId: string;
  cleanerAccountId: string;
  subtotal_cents: number;
  tip_cents?: number;
  add_ons_cents?: number;
  discount_cents?: number;
}

const PLATFORM_FEE_BPS = Number(Deno.env.get("STRIPE_PLATFORM_FEE_BPS") ?? "1900");
const CUSTOMER_FEE_BPS = Number(Deno.env.get("STRIPE_CUSTOMER_FEE_BPS") ?? "900");

function roundCents(n: number) {
  return Math.max(0, Math.round(n));
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = (await req.json()) as Body;

    const subtotal = body.subtotal_cents;
    const tip = body.tip_cents ?? 0;
    const addOns = body.add_ons_cents ?? 0;
    const discount = body.discount_cents ?? 0;

    const feeBase = Math.max(0, subtotal + addOns - discount);
    const platformFee = roundCents((PLATFORM_FEE_BPS / 10000) * feeBase);
    const customerFee = roundCents((CUSTOMER_FEE_BPS / 10000) * feeBase);

    const amount = roundCents(feeBase + tip + customerFee);

    const idemKey = `booking:${body.bookingId}`;

    const params: Stripe.PaymentIntentCreateParams = {
      amount,
      currency: "usd",
      application_fee_amount: platformFee,
      transfer_data: { destination: body.cleanerAccountId },
      automatic_payment_methods: { enabled: true },
      metadata: {
        booking_id: body.bookingId,
        cleaner_acct: body.cleanerAccountId,
        fee_base_cents: String(feeBase),
        customer_fee_cents: String(customerFee),
        platform_fee_cents: String(platformFee),
      },
    };

    const pi = await stripe.paymentIntents.create(params, {
      idempotencyKey: idemKey,
    });

    return new Response(
      JSON.stringify({
        clientSecret: pi.client_secret,
        amount_cents: amount,
        customer_fee_cents: customerFee,
        platform_fee_cents: platformFee,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "stripe_error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});
