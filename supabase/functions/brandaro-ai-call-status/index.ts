import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const callRecordId = url.searchParams.get("call_record_id");

    const formData = await req.formData();
    const callStatus = formData.get("CallStatus")?.toString() || "";
    const callDuration = formData.get("CallDuration")?.toString() || "0";
    const callSid = formData.get("CallSid")?.toString() || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (callRecordId) {
      const updates: any = { status: callStatus };

      if (callStatus === "completed") {
        updates.completed_at = new Date().toISOString();
        updates.duration_seconds = parseInt(callDuration);
      }

      if (callSid) updates.call_sid = callSid;

      // Map Twilio status to interest level
      if (callStatus === "completed" && parseInt(callDuration) > 30) {
        updates.interest_level = "medium";
        updates.outcome = "connected";
      } else if (callStatus === "completed" && parseInt(callDuration) <= 30) {
        updates.interest_level = "low";
        updates.outcome = "short_call";
      } else if (callStatus === "no-answer" || callStatus === "busy") {
        updates.outcome = callStatus;
        updates.interest_level = "unknown";
      }

      await supabase
        .from("brandaro_ai_calls")
        .update(updates)
        .eq("id", callRecordId);

      // Auto-progression: If high interest, assign to human VA
      if (updates.interest_level === "medium" || updates.interest_level === "high") {
        const { data: callData } = await supabase
          .from("brandaro_ai_calls")
          .select("lead_id, language")
          .eq("id", callRecordId)
          .single();

        if (callData) {
          await supabase
            .from("brandaro_leads_master")
            .update({ status: "ai_warmed" })
            .eq("id", callData.lead_id);
        }
      }
    }

    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Call status error:", error);
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  }
});
