import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { client_id, project_id, event_type, event_value, source, page_url, session_id, metadata } = await req.json();

    if (!client_id || !event_type) {
      return new Response(JSON.stringify({ error: "client_id and event_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert lead event
    const { error } = await supabase.from("brandaro_lead_events").insert({
      client_id,
      project_id: project_id || null,
      event_type,
      event_value: event_value || null,
      source: source || "direct",
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: req.headers.get("user-agent") || null,
      page_url: page_url || null,
      session_id: session_id || null,
      metadata: metadata || {},
    });

    if (error) throw error;

    // Auto-update daily metrics
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("brandaro_client_metrics")
      .select("*")
      .eq("client_id", client_id)
      .eq("period_date", today)
      .single();

    if (existing) {
      const updates: Record<string, any> = {};
      if (event_type === "form_submit") {
        updates.form_submissions = (existing.form_submissions || 0) + 1;
        updates.leads_generated = (existing.leads_generated || 0) + 1;
      } else if (event_type === "cta_click" || event_type === "phone_click") {
        updates.cta_clicks = (existing.cta_clicks || 0) + 1;
      } else if (event_type === "session") {
        updates.total_visitors = (existing.total_visitors || 0) + 1;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("brandaro_client_metrics").update(updates).eq("id", existing.id);
      }
    } else {
      await supabase.from("brandaro_client_metrics").insert({
        client_id,
        period_date: today,
        total_visitors: event_type === "session" ? 1 : 0,
        leads_generated: event_type === "form_submit" ? 1 : 0,
        form_submissions: event_type === "form_submit" ? 1 : 0,
        cta_clicks: ["cta_click", "phone_click"].includes(event_type) ? 1 : 0,
      });
    }

    // Check for alerts - if no leads in 7 days
    if (event_type === "session") {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      const { data: recentLeads } = await supabase
        .from("brandaro_lead_events")
        .select("id")
        .eq("client_id", client_id)
        .eq("event_type", "form_submit")
        .gte("created_at", weekAgo)
        .limit(1);

      if (!recentLeads || recentLeads.length === 0) {
        const { data: existingAlert } = await supabase
          .from("brandaro_client_alerts")
          .select("id")
          .eq("client_id", client_id)
          .eq("alert_type", "no_leads")
          .eq("is_resolved", false)
          .limit(1);

        if (!existingAlert || existingAlert.length === 0) {
          await supabase.from("brandaro_client_alerts").insert({
            client_id,
            alert_type: "no_leads",
            severity: "warning",
            message: "No leads generated in the past 7 days",
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Track lead event error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
