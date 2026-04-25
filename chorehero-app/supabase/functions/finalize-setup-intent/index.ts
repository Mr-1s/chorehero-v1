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

    const body = await req.json();
    const setupIntentId = body?.setupIntentId as string | undefined;
    if (!setupIntentId || typeof setupIntentId !== "string") {
      return new Response(JSON.stringify({ error: "setupIntentId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const si = await stripe.setupIntents.retrieve(setupIntentId);
    if (si.status !== "succeeded") {
      return new Response(
        JSON.stringify({ error: "Setup not complete", status: si.status }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const metaUid = si.metadata?.supabase_user_id;
    if (metaUid !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pmId = typeof si.payment_method === "string"
      ? si.payment_method
      : (si.payment_method as { id?: string } | null)?.id;
    if (!pmId) {
      return new Response(JSON.stringify({ error: "No payment method on setup intent" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.type !== "card" || !pm.card) {
      return new Response(JSON.stringify({ error: "Unsupported payment method" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existing } = await admin
      .from("payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("stripe_payment_method_id", pmId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ id: existing.id, alreadySaved: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const { count } = await admin
      .from("payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true);

    const isDefault = (count ?? 0) === 0;

    if (isDefault) {
      await admin
        .from("payment_methods")
        .update({ is_default: false })
        .eq("user_id", userId);
    }

    const { data: inserted, error: insErr } = await admin
      .from("payment_methods")
      .insert({
        user_id: userId,
        stripe_payment_method_id: pmId,
        type: "card",
        last_four: pm.card?.last4 ?? "0000",
        brand: pm.card?.brand ?? "card",
        exp_month: pm.card?.exp_month ?? 1,
        exp_year: pm.card?.exp_year ?? 2030,
        is_default: isDefault,
        is_active: true,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error(insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ id: inserted.id, success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
