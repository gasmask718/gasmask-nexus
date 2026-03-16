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

    const { demo_id, lead_id, event_type, event_value, session_id, ip_hash, user_agent } = await req.json();

    if (!demo_id || !event_type) {
      return new Response(JSON.stringify({ error: "demo_id and event_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert event
    const { error: eventErr } = await supabase.from("brandaro_demo_events").insert({
      demo_id,
      lead_id: lead_id || null,
      event_type,
      event_data: event_value ? { value: event_value } : {},
      ip_address: ip_hash || null,
    });
    if (eventErr) throw eventErr;

    // Update view count on demo site
    if (event_type === "page_view") {
      await supabase.rpc("increment_demo_view_count", { p_demo_id: demo_id }).catch(() => {
        // Fallback: direct update
        return supabase.from("brandaro_demo_sites")
          .update({ 
            view_count: undefined, // Will use raw SQL below
            last_viewed_at: new Date().toISOString() 
          })
          .eq("id", demo_id);
      });
    }

    // Calculate engagement score
    const SCORE_MAP: Record<string, number> = {
      page_view: 5,
      scroll_25: 3,
      scroll_50: 5,
      scroll_75: 8,
      cta_click: 15,
      contact_click: 20,
      proposal_click: 20,
      return_visit: 10,
    };
    const score = SCORE_MAP[event_type] || 1;

    // Get current lead engagement score and update
    if (lead_id) {
      const { data: lead } = await supabase
        .from("brandaro_qualified_leads")
        .select("engagement_score, lead_status")
        .eq("id", lead_id)
        .single();

      const newScore = (lead?.engagement_score || 0) + score;
      const updates: Record<string, any> = { engagement_score: newScore };

      // Auto-promote: 50 = hot_lead, 100 = priority_call
      if (newScore >= 100 && lead?.lead_status !== "sold" && lead?.lead_status !== "priority_call") {
        updates.lead_status = "priority_call";
      } else if (newScore >= 50 && !["hot_lead", "priority_call", "sold"].includes(lead?.lead_status || "")) {
        updates.lead_status = "hot_lead";
      }

      await supabase
        .from("brandaro_qualified_leads")
        .update(updates)
        .eq("id", lead_id);
    }

    return new Response(JSON.stringify({ ok: true, score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Track demo event error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
