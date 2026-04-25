/**
 * Deletes the authenticated user's account and associated application data.
 * Uses service role for auth.admin.deleteUser; validates JWT so users can only delete themselves.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const authUser = createClient(supabaseUrl, supabaseAnonKey);
  const { data: userData, error: userErr } = await authUser.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userErr || !userId) {
    return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Remove user media from storage while we can still read content_posts
    const { data: posts } = await admin
      .from("content_posts")
      .select("media_url, thumbnail_url, secondary_media_url")
      .eq("user_id", userId);

    const paths: string[] = [];
    for (const post of posts || []) {
      for (const url of [post.media_url, post.thumbnail_url, post.secondary_media_url]) {
        if (!url || typeof url !== "string") continue;
        try {
          const u = new URL(url);
          const parts = u.pathname.split("/").filter(Boolean);
          const bucketIdx = parts.indexOf("content");
          if (bucketIdx >= 0 && parts.length > bucketIdx + 1) {
            paths.push(parts.slice(bucketIdx + 1).join("/"));
          } else {
            const fileName = parts[parts.length - 1];
            if (fileName) paths.push(url.includes("/videos/") ? `videos/${fileName}` : `images/${fileName}`);
          }
        } catch {
          // ignore bad URLs
        }
      }
    }

    if (paths.length > 0) {
      const { error: storageErr } = await admin.storage.from("content").remove(paths);
      if (storageErr) {
        console.warn("delete-account: partial storage cleanup", storageErr);
      }
    }

    // Optional: avatar in public profile — common bucket names
    for (const bucket of ["avatars", "profiles"]) {
      const { data: list } = await admin.storage.from(bucket).list(userId, { limit: 100 });
      if (list?.length) {
        const toRemove = list.map((f) => `${userId}/${f.name}`);
        await admin.storage.from(bucket).remove(toRemove);
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      // SECURITY (audit F-09): full error detail logged server-side; client
      // gets a generic message to avoid leaking internal error shapes.
      console.error("delete-account: auth.admin.deleteUser", delErr);
      return new Response(
        JSON.stringify({ error: "Failed to delete account" }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (e) {
    console.error("delete-account", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "delete_failed" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
