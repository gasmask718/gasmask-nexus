import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const business_id = body?.business_id;

    if (!business_id) {
      return json({ success: false, error: "business_id required" }, 200);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();

    // Clear stale queue items
    const { data: clearedQueue, error: qErr } = await supabase
      .from("outbound_call_queue")
      .update({ status: "failed", updated_at: now })
      .eq("business_id", business_id)
      .in("status", ["queued", "dialing"])
      .select("id");

    if (qErr) console.error("Queue recovery error:", JSON.stringify(qErr));

    // Clear stale live calls
    const { data: clearedLive, error: lErr } = await supabase
      .from("live_calls")
      .update({ state: "failed", ended_at: now, updated_at: now })
      .eq("business_id", business_id)
      .not("state", "in", '("completed","failed")')
      .select("id");

    if (lErr) console.error("Live calls recovery error:", JSON.stringify(lErr));

    const result = {
      success: true,
      queue_recovered: clearedQueue?.length ?? 0,
      live_recovered: clearedLive?.length ?? 0,
    };

    console.log(JSON.stringify({ action: "DIALER_RECOVERY", business_id, ...result }));

    // Always return 200 so the UI unlocks
    return json(result, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("recover-dialer fatal:", message);

    // Still return 200 so the UI is never permanently blocked
    return json({ success: false, recovered: false, error: message }, 200);
  }
});
