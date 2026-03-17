import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * brandaro-build-worker
 * 
 * Cron worker that processes queued build jobs.
 * Picks up jobs in 'queued' or 'failed' (with retries remaining) status
 * and triggers brandaro-auto-build for each.
 * 
 * Runs every 5 minutes via pg_cron.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Find queued jobs
    const { data: queuedJobs } = await supabase
      .from("brandaro_build_jobs")
      .select("*")
      .eq("build_status", "queued")
      .order("created_at", { ascending: true })
      .limit(5);

    // Find failed jobs eligible for retry
    const { data: failedJobs } = await supabase
      .from("brandaro_build_jobs")
      .select("*")
      .eq("build_status", "failed")
      .lt("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(3);

    const allJobs = [...(queuedJobs || []), ...(failedJobs || [])];
    
    if (allJobs.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No jobs to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const job of allJobs) {
      try {
        // Increment retry count for failed jobs
        if (job.build_status === "failed") {
          await supabase.from("brandaro_build_jobs").update({
            retry_count: (job.retry_count || 0) + 1,
            build_status: "queued",
            progress_stage: "retry_queued",
          }).eq("id", job.id);
        }

        // Trigger auto-build
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/brandaro-auto-build`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            client_id: job.client_id,
            project_id: job.project_id,
            demo_id: job.demo_id,
            package_tier: job.package_tier,
          }),
        });

        const result = await resp.json();
        results.push({ job_id: job.id, status: resp.ok ? "triggered" : "error", result });

        if (!resp.ok) {
          await supabase.from("brandaro_build_jobs").update({
            build_status: "failed",
            progress_stage: `worker_error_${resp.status}`,
          }).eq("id", job.id);
        }
      } catch (jobErr) {
        console.error(`[BUILD-WORKER] Error processing job ${job.id}:`, jobErr);
        await supabase.from("brandaro_build_jobs").update({
          build_status: "failed",
          progress_stage: "worker_exception",
        }).eq("id", job.id);
        results.push({ job_id: job.id, status: "exception", error: jobErr.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[BUILD-WORKER] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
