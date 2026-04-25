/**
 * Notify Founder SMS - optional SMS to founder on new job, quote, booking.
 * When TEST_MODE: logs to console. When !TEST_MODE: sends via Twilio if configured.
 *
 * Body: { type: 'new_job' | 'new_quote' | 'booking_confirmed', job_id?: string, quote_id?: string, booking_id?: string }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TEST_MODE = Deno.env.get("TEST_MODE") === "true";
const FOUNDER_PHONE = Deno.env.get("FOUNDER_PHONE");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = Deno.env.get("TWILIO_FROM");

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // SECURITY (audit F-05): the previous handler had no auth. Anyone could
    // POST to this endpoint and trigger a Twilio message (cost / abuse).
    // Require either a JWT (so it's tied to a real user signaling intent) or
    // an internal shared secret for trusted server-side fan-out.
    const authHeader = req.headers.get("Authorization") ?? "";
    const internalSecret = req.headers.get("x-internal-secret") ?? "";
    const expectedInternal = Deno.env.get("INTERNAL_SHARED_SECRET");
    const isInternal =
      !!expectedInternal && internalSecret && internalSecret === expectedInternal;
    if (!isInternal && !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as {
      type?: string;
      job_id?: string;
      quote_id?: string;
      booking_id?: string;
    };
    const { type = "unknown", job_id, quote_id, booking_id } = body;

    const msg =
      type === "new_job"
        ? `ChoreHero: New job posted ${job_id || ""}`
        : type === "new_quote"
          ? `ChoreHero: New quote received ${quote_id || ""}`
          : type === "booking_confirmed"
            ? `ChoreHero: Booking confirmed ${booking_id || ""}`
            : `ChoreHero: ${type} ${job_id || quote_id || booking_id || ""}`;

    if (TEST_MODE) {
      console.log("[TEST_MODE] SMS (would send):", msg);
      return new Response(
        JSON.stringify({ success: true, test_mode: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!FOUNDER_PHONE || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      console.log("[notify-founder-sms] Twilio not configured, skipping SMS");
      return new Response(
        JSON.stringify({ success: false, reason: "Twilio not configured" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      },
      body: new URLSearchParams({
        To: FOUNDER_PHONE,
        From: TWILIO_FROM,
        Body: msg,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Twilio error:", err);
      return new Response(
        JSON.stringify({ success: false, error: err }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-founder-sms error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
