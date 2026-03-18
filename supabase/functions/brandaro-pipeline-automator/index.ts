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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "auto_move";

    // ── ACTION: Record an event and auto-move pipeline ──
    if (action === "record_event") {
      const { lead_id, event_type, message_content } = body;
      if (!lead_id || !event_type) {
        return new Response(JSON.stringify({ error: "lead_id and event_type required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let newStage: string | null = null;

      switch (event_type) {
        case "sms_sent":
        case "call_made":
          newStage = "contacted";
          break;
        case "sms_reply":
        case "call_answered":
          newStage = "responded";
          break;
        case "interest_detected":
          newStage = "interested";
          break;
        case "appointment_booked":
          newStage = "booked";
          break;
        case "revenue_recorded":
          newStage = "closed";
          break;
        case "negative_response":
        case "dnc":
          newStage = "lost";
          break;
      }

      // If message_content provided, run keyword intent detection
      if (message_content && !newStage) {
        const lower = (message_content as string).toLowerCase();
        const interestKeywords = [
          "interested", "yes", "how much", "tell me more", "what's the price",
          "send info", "let's talk", "sounds good", "i'm in", "sign me up",
          "when can", "available", "book", "schedule", "appointment",
        ];
        const negativeKeywords = [
          "not interested", "stop", "remove", "don't call", "do not contact",
          "unsubscribe", "no thanks", "leave me alone", "already have",
        ];

        if (negativeKeywords.some((k) => lower.includes(k))) {
          newStage = "lost";
        } else if (interestKeywords.some((k) => lower.includes(k))) {
          newStage = "interested";
        } else {
          // Any reply = at least "responded"
          newStage = "responded";
        }
      }

      if (newStage) {
        // Only advance forward (never regress), except for "lost"
        const stageOrder = ["new", "contacted", "responded", "interested", "booked", "closed"];
        const { data: currentLead } = await sb
          .from("brandaro_qualified_leads")
          .select("pipeline_stage")
          .eq("id", lead_id)
          .single();

        const currentIdx = stageOrder.indexOf(currentLead?.pipeline_stage || "new");
        const newIdx = stageOrder.indexOf(newStage);

        if (newStage === "lost" || newStage === "closed" || newIdx > currentIdx) {
          await sb
            .from("brandaro_qualified_leads")
            .update({ pipeline_stage: newStage, updated_at: new Date().toISOString() })
            .eq("id", lead_id);

          console.log(`✅ Lead ${lead_id}: ${currentLead?.pipeline_stage} → ${newStage}`);
        }
      }

      return new Response(JSON.stringify({ success: true, new_stage: newStage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: Bulk auto-move based on existing data ──
    if (action === "auto_move") {
      const { data: leads } = await sb
        .from("brandaro_qualified_leads")
        .select("id, pipeline_stage, lead_status, call_attempts, last_call_at, engagement_score")
        .in("pipeline_stage", ["new", "contacted"])
        .limit(200);

      let moved = 0;
      for (const lead of leads || []) {
        let targetStage: string | null = null;

        if (lead.lead_status === "sold") {
          targetStage = "closed";
        } else if (lead.lead_status === "hot_lead" || lead.engagement_score >= 60) {
          targetStage = "interested";
        } else if (lead.call_attempts > 0 && lead.pipeline_stage === "new") {
          targetStage = "contacted";
        }

        if (targetStage && targetStage !== lead.pipeline_stage) {
          await sb
            .from("brandaro_qualified_leads")
            .update({ pipeline_stage: targetStage, updated_at: new Date().toISOString() })
            .eq("id", lead.id);
          moved++;
        }
      }

      return new Response(JSON.stringify({ success: true, leads_moved: moved }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: Get stuck leads + follow-up needs ──
    if (action === "get_insights") {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      // Stuck: in "contacted" for >48h with no advancement
      const { data: stuck } = await sb
        .from("brandaro_qualified_leads")
        .select("id, business_name, phone_number, city, industry, pipeline_stage, updated_at, priority_score")
        .eq("pipeline_stage", "contacted")
        .lt("updated_at", twoDaysAgo)
        .order("priority_score", { ascending: false })
        .limit(20);

      // Needs follow-up: "responded" but not yet "interested"
      const { data: needsFollowup } = await sb
        .from("brandaro_qualified_leads")
        .select("id, business_name, phone_number, city, industry, pipeline_stage, updated_at, priority_score, engagement_score")
        .eq("pipeline_stage", "responded")
        .order("priority_score", { ascending: false })
        .limit(20);

      // Hot leads: high engagement/score in interested+
      const { data: hot } = await sb
        .from("brandaro_qualified_leads")
        .select("id, business_name, phone_number, city, industry, pipeline_stage, priority_score, engagement_score")
        .in("pipeline_stage", ["interested", "booked"])
        .order("priority_score", { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({ stuck: stuck || [], needsFollowup: needsFollowup || [], hot: hot || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Pipeline automator error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
