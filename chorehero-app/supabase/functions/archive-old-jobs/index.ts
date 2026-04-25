/**
 * Archive old jobs - runs daily via cron.
 * 1. Jobs with status=booked and booked_at > 30 days ago: delete media from storage, set archived=true
 * 2. Jobs with deleted=true and deleted_at > 1 year ago: hard delete (cascade removes job_media)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function parseStoragePath(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

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

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - THIRTY_DAYS_MS).toISOString();
  const oneYearAgo = new Date(now - ONE_YEAR_MS).toISOString();

  let archivedCount = 0;
  let hardDeletedCount = 0;

  try {
    // 1. Archive jobs: status=booked, booked_at or updated_at < 30 days ago, not already archived
    const { data: oldJobs, error: fetchErr } = await supabase
      .from("jobs")
      .select("id")
      .eq("status", "booked")
      .eq("archived", false)
      .or(`booked_at.lt.${thirtyDaysAgo},updated_at.lt.${thirtyDaysAgo}`)
      .limit(100);

    if (!fetchErr && oldJobs?.length) {
      for (const job of oldJobs) {
        const { data: mediaRows } = await supabase
          .from("job_media")
          .select("media_url")
          .eq("job_id", job.id);

        if (mediaRows?.length) {
          for (const row of mediaRows) {
            const parsed = parseStoragePath(row.media_url || "");
            if (parsed) {
              try {
                await supabase.storage.from(parsed.bucket).remove([parsed.path]);
              } catch {
                // Non-blocking
              }
            }
          }
        }

        await supabase.from("job_media").delete().eq("job_id", job.id);
        await supabase
          .from("jobs")
          .update({ archived: true })
          .eq("id", job.id);

        archivedCount++;
      }
    }

    // 2. Hard delete: deleted=true, deleted_at < 1 year ago
    const { data: toHardDelete } = await supabase
      .from("jobs")
      .select("id")
      .eq("deleted", true)
      .lt("deleted_at", oneYearAgo)
      .limit(100);

    if (toHardDelete?.length) {
      for (const job of toHardDelete) {
        await supabase.from("job_media").delete().eq("job_id", job.id);
        await supabase.from("jobs").delete().eq("id", job.id);
        hardDeletedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        archived: archivedCount,
        hardDeleted: hardDeletedCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("archive-old-jobs error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "archive_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
