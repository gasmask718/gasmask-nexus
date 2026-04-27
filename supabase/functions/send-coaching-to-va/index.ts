// Persist a coaching report (already produced by analyze-va-call) into
// brandaro_va_coaching so the VA sees it inside their dashboard.

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
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) throw new Error("Authorization required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userRes } = await supabase.auth.getUser();
    const manager = userRes?.user;
    if (!manager) throw new Error("Not authenticated");

    const { call_log_id, custom_note } = await req.json();
    if (!call_log_id) throw new Error("call_log_id required");

    const { data: call, error: callErr } = await supabase
      .from("va_call_logs")
      .select("id, va_id, ai_analysis")
      .eq("id", call_log_id)
      .maybeSingle();

    if (callErr) throw callErr;
    if (!call) throw new Error("Call log not found");
    if (!call.ai_analysis) throw new Error("Run AI analysis first before sending to VA");
    if (!call.va_id) throw new Error("This call has no VA assigned");

    const a: any = call.ai_analysis;

    const { data: inserted, error: insertErr } = await supabase
      .from("brandaro_va_coaching")
      .insert({
        va_user_id: call.va_id,
        manager_user_id: manager.id,
        call_log_id: call.id,
        coaching_type: "call_review",
        summary: a.summary ?? null,
        strengths: a.va_strengths ?? [],
        weak_points: a.va_improvements ?? [],
        recommendations: a.recommended_rebuttals ?? [],
        handling_tips: a.handling_tips ?? [],
        improvement_target: a.coaching_note ?? null,
        rating: typeof a.overall_score === "number" ? Math.round(a.overall_score) : null,
        quality_score: typeof a.overall_score === "number" ? Math.round(a.overall_score * 10) : null,
        call_quality_score: typeof a.overall_score === "number" ? Math.round(a.overall_score * 10) : null,
        notes: custom_note ?? null,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, coaching: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-coaching-to-va error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
