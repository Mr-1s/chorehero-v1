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
  user_id?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  /** When set, also inserts a row into public.notifications (service role). */
  insertNotification?: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // SECURITY (audit F-04): previously this function trusted the body's
    // `userId` as the recipient, allowing IDOR — any authenticated caller
    // could trigger a push to anyone. Now we either:
    //   (a) require an internal service secret (`X-Internal-Secret` matching
    //       `INTERNAL_SHARED_SECRET`) — used by trusted backend callers /
    //       triggers that fan out to many users
    //   (b) require a JWT and allow self-targeting OR a booking participant
    //       notifying the other participant.
    const authHeader = req.headers.get("Authorization") ?? "";
    const internalSecret = req.headers.get("x-internal-secret") ?? "";
    const expectedInternal = Deno.env.get("INTERNAL_SHARED_SECRET");
    const isInternal =
      !!expectedInternal && internalSecret && internalSecret === expectedInternal;

    let callerUserId: string | null = null;
    if (!isInternal) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing auth" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      const token = authHeader.replace("Bearer ", "");
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const { data: { user } } = await authClient.auth.getUser(token);
      if (!user?.id) {
        return new Response(
          JSON.stringify({ error: "Invalid auth" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      callerUserId = user.id;
    }

    const body = (await req.json()) as Body & { user_id?: string };
    const { title, body: messageBody, data = {}, badge } = body;
    const requestedUserId = body.userId ?? body.user_id;

    const userId = isInternal ? requestedUserId : requestedUserId;

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

    if (!isInternal) {
      const bookingId =
        typeof data.booking_id === "string"
          ? data.booking_id
          : typeof data.bookingId === "string"
            ? data.bookingId
            : null;

      if (userId !== callerUserId) {
        if (!bookingId) {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }

        const { data: booking, error: bookingErr } = await supabase
          .from("bookings")
          .select("customer_id, cleaner_id")
          .eq("id", bookingId)
          .maybeSingle();

        const participants = [booking?.customer_id, booking?.cleaner_id].filter(Boolean);
        if (
          bookingErr ||
          !participants.includes(callerUserId) ||
          !participants.includes(userId)
        ) {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (body.insertNotification) {
      const ins = body.insertNotification;
      const { error: insErr } = await supabase.from("notifications").insert({
        user_id: userId,
        type: ins.type,
        title: ins.title,
        message: ins.message,
        data: (ins.data ?? {}) as Record<string, unknown>,
        is_read: false,
      });
      if (insErr) {
        console.error("insertNotification failed:", insErr);
      }
    }

    const { data: tokens, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("push_token")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (tokenError || !tokens?.length) {
      return new Response(
        JSON.stringify({
          success: body.insertNotification ? true : false,
          reason: "No push token for user",
          notification_saved: Boolean(body.insertNotification),
        }),
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
      ...(badge !== undefined && { badge }),
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
