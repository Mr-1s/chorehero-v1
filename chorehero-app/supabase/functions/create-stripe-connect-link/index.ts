// Stripe Connect onboarding for cleaners.
// Creates a Stripe Express account if the cleaner doesn't have one, then a
// fresh Account Link the app can open in a WebBrowser.
//
// Body: { refreshUrl?: string, returnUrl?: string }   (deep links back into the app)
// Response: { onboardingUrl: string, accountId: string }
//
// Required project secrets: STRIPE_SECRET_KEY, SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const DEFAULT_REFRESH = "chorehero://stripe-connect-refresh";
const DEFAULT_RETURN = "chorehero://stripe-connect-return";

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

    const body = await req.json().catch(() => ({}));
    const refreshUrl = (body?.refreshUrl as string | undefined) || DEFAULT_REFRESH;
    const returnUrl = (body?.returnUrl as string | undefined) || DEFAULT_RETURN;

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Ensure user is a cleaner before granting a Connect account.
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("id, email, role")
      .eq("id", userId)
      .single();

    if (userErr || !userRow) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (userRow.role !== "cleaner") {
      return new Response(
        JSON.stringify({ error: "Only cleaner accounts can set up payouts" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: profile, error: profileErr } = await admin
      .from("cleaner_profiles")
      .select("user_id, stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileErr) {
      console.error("cleaner_profiles fetch failed:", profileErr);
      return new Response(JSON.stringify({ error: "Profile lookup failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let accountId = profile?.stripe_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: userRow.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_type: "individual",
        metadata: { supabase_user_id: userId },
      });
      accountId = account.id;

      // Persist the account id immediately so we can recover from a partial
      // onboarding (user closes the browser before finishing).
      const { error: upsertErr } = await admin
        .from("cleaner_profiles")
        .upsert(
          {
            user_id: userId,
            stripe_account_id: accountId,
            stripe_onboarding_complete: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (upsertErr) {
        console.error("cleaner_profiles upsert failed:", upsertErr);
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({ onboardingUrl: accountLink.url, accountId }),
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
