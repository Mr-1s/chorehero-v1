import { serve } from "https://deno.land/std/http/server.ts";
import Stripe from "https://esm.sh/stripe@15.12.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

serve(async (req) => {
  const sig = req.headers.get("stripe-signature")!;
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      // TODO: mark booking paid in Supabase using pi.metadata.booking_id
      break;
    }
    case "account.updated": {
      // TODO: sync cleaner onboarding status
      break;
    }
  }

  return new Response("ok", { status: 200 });
});
