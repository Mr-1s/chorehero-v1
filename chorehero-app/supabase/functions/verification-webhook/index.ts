import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("VERIFICATION_WEBHOOK_SECRET")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

type VerificationPayload = {
  provider?: "checkr" | "persona" | "manual";
  event: string;
  user_id: string;
  status: string;
  metadata?: Record<string, unknown>;
};

const normalizeStatus = (status: string) => status.toLowerCase().trim();

serve(async (req) => {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: VerificationPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { event, user_id, status } = payload;
  if (!event || !user_id || !status) {
    return new Response("Missing required fields", { status: 400 });
  }

  const normalizedStatus = normalizeStatus(status);

  try {
    if (event === "identity.verified") {
      const verificationStatus = normalizedStatus === "verified" ? "verified" : "rejected";
      const { error } = await supabase
        .from("cleaner_profiles")
        .update({ verification_status: verificationStatus })
        .eq("user_id", user_id);
      if (error) throw error;
    }

    if (event === "background_check.completed") {
      const mappedStatus =
        normalizedStatus === "cleared" ? "cleared" :
        normalizedStatus === "failed" ? "failed" :
        "in_progress";

      const { error } = await supabase
        .from("cleaner_profiles")
        .update({ background_check_status: mappedStatus })
        .eq("user_id", user_id);
      if (error) throw error;
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Verification webhook error:", error);
    return new Response("Server error", { status: 500 });
  }
});
