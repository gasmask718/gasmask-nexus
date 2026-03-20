import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fixes: Record<string, number> = {};

    // Fix 1: Set pipeline_stage for leads missing it
    const { data: nullStage } = await sb
      .from("brandaro_qualified_leads")
      .select("id")
      .or("pipeline_stage.is.null,pipeline_stage.eq.")
      .limit(500);

    if (nullStage && nullStage.length > 0) {
      for (const lead of nullStage) {
        await sb.from("brandaro_qualified_leads").update({ pipeline_stage: "new" }).eq("id", lead.id);
      }
      fixes.null_stage_fixed = nullStage.length;
    }

    // Fix 2: Set lead_status for nulls
    const { data: nullStatus } = await sb
      .from("brandaro_qualified_leads")
      .select("id")
      .or("lead_status.is.null,lead_status.eq.")
      .limit(500);

    if (nullStatus && nullStatus.length > 0) {
      for (const lead of nullStatus) {
        await sb.from("brandaro_qualified_leads").update({ lead_status: "new" }).eq("id", lead.id);
      }
      fixes.null_status_fixed = nullStatus.length;
    }

    // Fix 3: Set website_status for scout-imported leads
    const { data: nullWebsite } = await sb
      .from("brandaro_qualified_leads")
      .select("id")
      .not("discovery_job_id", "is", null)
      .is("website_status", null)
      .limit(500);

    if (nullWebsite && nullWebsite.length > 0) {
      for (const lead of nullWebsite) {
        await sb.from("brandaro_qualified_leads").update({ website_status: "no_website", has_website: false }).eq("id", lead.id);
      }
      fixes.website_status_fixed = nullWebsite.length;
    }

    // Fix 4: Unpause new leads that shouldn't be paused
    const { data: pausedNew } = await sb
      .from("brandaro_qualified_leads")
      .select("id")
      .eq("ai_paused", true)
      .eq("pipeline_stage", "new")
      .limit(500);

    if (pausedNew && pausedNew.length > 0) {
      for (const lead of pausedNew) {
        await sb.from("brandaro_qualified_leads").update({ ai_paused: false }).eq("id", lead.id);
      }
      fixes.unpaused = pausedNew.length;
    }

    // Fix 5: Set engagement_score default
    const { data: nullEngagement } = await sb
      .from("brandaro_qualified_leads")
      .select("id")
      .is("engagement_score", null)
      .limit(500);

    if (nullEngagement && nullEngagement.length > 0) {
      for (const lead of nullEngagement) {
        await sb.from("brandaro_qualified_leads").update({ engagement_score: 0 }).eq("id", lead.id);
      }
      fixes.engagement_fixed = nullEngagement.length;
    }

    // Fix 6: Set call_attempts default
    const { data: nullCalls } = await sb
      .from("brandaro_qualified_leads")
      .select("id")
      .is("call_attempts", null)
      .limit(500);

    if (nullCalls && nullCalls.length > 0) {
      for (const lead of nullCalls) {
        await sb.from("brandaro_qualified_leads").update({ call_attempts: 0 }).eq("id", lead.id);
      }
      fixes.call_attempts_fixed = nullCalls.length;
    }

    const totalFixed = Object.values(fixes).reduce((s, v) => s + v, 0);

    console.log(`[FIX-IMPORTS] Fixed ${totalFixed} leads:`, fixes);

    return new Response(
      JSON.stringify({ success: true, total_fixed: totalFixed, fixes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[FIX-IMPORTS] Error:", e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
