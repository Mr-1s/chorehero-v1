// Refresh the cleaner's Stripe Connect status.
// Called after the user returns from the Stripe-hosted onboarding browser, OR
// any time the app wants to know if payouts are ready.
//
// Body: {}  (uses the JWT to identify the cleaner)
// Response: {
//   accountId: string | null,
//   onboardingComplete: boolean,
//   payoutsEnabled: boolean,
//   detailsSubmitted: boolean,
//   requirements: string[],
// }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

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
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    const userId = user?.id;
    if (authError || !userId) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await admin
      .from("cleaner_profiles")
      .select("user_id, stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", userId)
      .maybeSingle();

    const accountId = profile?.stripe_account_id as string | null;
    if (!accountId) {
      return new Response(
        JSON.stringify({
          accountId: null,
          onboardingComplete: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          requirements: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const account = await stripe.accounts.retrieve(accountId);
    const detailsSubmitted = !!account.details_submitted;
    const payoutsEnabled = !!account.payouts_enabled;
    const onboardingComplete = detailsSubmitted && payoutsEnabled;

    // Persist the snapshot so the app's gate (`stripe_onboarding_complete`)
    // doesn't lag the actual Stripe state.
    await admin
      .from("cleaner_profiles")
      .update({
        stripe_onboarding_complete: onboardingComplete,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    const requirements: string[] = [
      ...(account.requirements?.currently_due ?? []),
      ...(account.requirements?.eventually_due ?? []),
    ];

    return new Response(
      JSON.stringify({
        accountId,
        onboardingComplete,
        payoutsEnabled,
        detailsSubmitted,
        requirements,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "stripe_error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});
