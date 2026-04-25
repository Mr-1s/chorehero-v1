/**
 * Storage cleanup - runs weekly via cron.
 * 1. Delete orphaned files: in content-videos, content-images with no job_media or quotes reference
 * 2. Retention: quote videos and job media older than 30 days (optional - archive-old-jobs handles job media)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKETS = ["content-videos", "content-images"];

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let removedCount = 0;

  try {
    for (const bucket of BUCKETS) {
      const { data: files, error: listErr } = await supabase.storage
        .from(bucket)
        .list("", { limit: 1000 });

      if (listErr || !files?.length) continue;

      const { data: jobMedia } = await supabase
        .from("job_media")
        .select("media_url")
        .eq("media_type", bucket === "content-videos" ? "video" : "photo");

      const { data: quotes } = await supabase
        .from("quotes")
        .select("video_url");

      const referencedUrls = new Set<string>();
      if (jobMedia) {
        jobMedia.forEach((r) => r.media_url && referencedUrls.add(r.media_url));
      }
      if (quotes) {
        quotes.forEach((q) => q.video_url && referencedUrls.add(q.video_url));
      }

      for (const file of files) {
        if (!file.name) continue;
        const fullPath = file.id || file.name;
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fullPath);
        const publicUrl = urlData?.publicUrl;

        if (publicUrl && !referencedUrls.has(publicUrl)) {
          try {
            await supabase.storage.from(bucket).remove([fullPath]);
            removedCount++;
          } catch {
            // Non-blocking
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        removed: removedCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("cleanup-storage error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "cleanup_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
