/**
 * Send Push - Expo push notifications for new jobs
 *
 * Invoked by notificationService.notifyCleanersOfNewJob when a marketplace
 * booking is created. Sends push to cleaners within radius.
 *
 * Body: { userId: string, title: string, body: string, data?: Record<string, any> }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Body {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = (await req.json()) as Body;
    const { userId, title, body: messageBody, data = {} } = body;

    if (!userId || !title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "userId, title, and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokens, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("push_token")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (tokenError || !tokens?.length) {
      return new Response(
        JSON.stringify({ success: false, reason: "No push token for user" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const expoPushMessages = tokens.map(({ push_token }) => ({
      to: push_token,
      title,
      body: messageBody,
      data: { ...data, type: data.type || "booking_request" },
      sound: "default",
      priority: "high",
      channelId: "job_alerts",
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(expoPushMessages),
    });

    const result = await response.json();
    if (result.data?.some((d: { status: string }) => d.status === "error")) {
      console.error("Expo push errors:", result);
    }

    return new Response(
      JSON.stringify({ success: true, sent: expoPushMessages.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const e = err as Error;
    console.error("Send push error:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "Push send failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
