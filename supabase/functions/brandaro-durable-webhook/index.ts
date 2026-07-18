import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-durable-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const bodyText = await req.text();
    const expected = Deno.env.get("DURABLE_WEBHOOK_SECRET");
    const supplied = req.headers.get("x-durable-signature") || req.headers.get("X-Durable-Signature");

    if (expected && supplied !== expected) {
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(bodyText);
    // Expected shape: { event: 'site.ready'|'site.failed', site_id, site_url?, screenshot_url?, error?, external_reference? }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const siteId = payload.site_id || payload.data?.id;
    const extRef = payload.external_reference || payload.data?.external_reference;
    const event = payload.event || payload.type;

    if (!siteId && !extRef) {
      return new Response(JSON.stringify({ error: "missing site_id or external_reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isReady = event === "site.ready" || event === "site.published" || event === "ready";
    const isFailed = event === "site.failed" || event === "failed";

    const update: Record<string, any> = {
      durable_last_error: null,
    };

    if (isReady) {
      update.durable_job_status = "ready";
      update.engine_status = "ready";
      update.generation_status = "ready";
      update.demo_ready_for_conversion = true;
      if (payload.site_url || payload.data?.url) update.durable_generated_url = payload.site_url || payload.data?.url;
      if (payload.screenshot_url || payload.data?.screenshot_url) update.durable_screenshot_url = payload.screenshot_url || payload.data?.screenshot_url;
      if (payload.site_url || payload.data?.url) update.demo_url = payload.site_url || payload.data?.url;
    } else if (isFailed) {
      update.durable_job_status = "error";
      update.engine_status = "error";
      update.generation_status = "error";
      update.durable_last_error = payload.error || payload.message || "Durable reported failure";
      update.error_message = update.durable_last_error;
    } else {
      update.durable_job_status = event || "processing";
    }

    const query = supabase.from("brandaro_demo_sites").update(update);
    const { data, error } = extRef
      ? await query.eq("id", extRef).select()
      : await query.eq("durable_site_id", siteId).select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, updated: data?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Durable webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
