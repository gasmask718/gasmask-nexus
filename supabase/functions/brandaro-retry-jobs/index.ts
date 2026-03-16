import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { dry_run } = await req.json().catch(() => ({ dry_run: false }));

    // Find jobs pending retry
    const { data: jobs, error } = await supabase
      .from("brandaro_job_failures")
      .select("*")
      .eq("status", "pending_retry")
      .lte("retry_at", new Date().toISOString())
      .order("retry_at", { ascending: true })
      .limit(10);

    if (error) throw error;

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, pending: jobs?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let retried = 0;
    let failed = 0;

    for (const job of jobs || []) {
      try {
        // Determine retry action
        let retryResult = false;

        if (job.job_type === "send_demo" && job.entity_id) {
          const { data } = await supabase.functions.invoke("brandaro-send-demo", {
            body: { demo_id: job.entity_id, lead_id: null, channel: "sms", destination: "" },
          });
          retryResult = data?.ok || false;
        } else if (job.job_type === "send_followup" && job.entity_id) {
          // Re-queue the followup as pending
          await supabase
            .from("brandaro_followups")
            .update({ status: "pending" })
            .eq("id", job.entity_id);
          retryResult = true;
        } else if (job.job_type === "demo_generation" && job.entity_id) {
          // Re-trigger native generation
          const { data } = await supabase.functions.invoke("brandaro-generate-demo", {
            body: { lead_id: job.entity_id, engine: "native" },
          });
          retryResult = !!data?.demo;
        }

        if (retryResult) {
          await supabase
            .from("brandaro_job_failures")
            .update({ status: "resolved", resolved_at: new Date().toISOString() })
            .eq("id", job.id);
          retried++;
        } else {
          throw new Error("Retry did not succeed");
        }
      } catch (err: any) {
        const newAttempt = (job.attempt_count || 1) + 1;
        const maxRetries = 3;

        if (newAttempt > maxRetries) {
          // Max retries exhausted
          await supabase
            .from("brandaro_job_failures")
            .update({
              status: "failed_final",
              attempt_count: newAttempt,
              last_error: err.message,
            })
            .eq("id", job.id);
        } else {
          // Schedule next retry with exponential backoff
          const delayMs = [5 * 60_000, 30 * 60_000, 6 * 3600_000][newAttempt - 1] || 3600_000;
          await supabase
            .from("brandaro_job_failures")
            .update({
              attempt_count: newAttempt,
              last_error: err.message,
              retry_at: new Date(Date.now() + delayMs).toISOString(),
            })
            .eq("id", job.id);
        }
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, retried, failed, total: jobs?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Retry engine error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
