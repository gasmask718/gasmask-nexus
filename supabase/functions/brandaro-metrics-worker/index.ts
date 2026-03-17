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

    const today = new Date().toISOString().split("T")[0];

    // Get all active clients
    const { data: clients } = await supabase
      .from("brandaro_clients")
      .select("id")
      .eq("client_status", "active");

    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No active clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const client of clients) {
      // Count today's events
      const { data: events } = await supabase
        .from("brandaro_lead_events")
        .select("event_type")
        .eq("client_id", client.id)
        .gte("created_at", `${today}T00:00:00Z`)
        .lte("created_at", `${today}T23:59:59Z`);

      const { data: calls } = await supabase
        .from("brandaro_call_logs")
        .select("id")
        .eq("client_id", client.id)
        .gte("created_at", `${today}T00:00:00Z`);

      const sessions = events?.filter(e => e.event_type === "session").length || 0;
      const forms = events?.filter(e => e.event_type === "form_submit").length || 0;
      const clicks = events?.filter(e => ["cta_click", "phone_click"].includes(e.event_type)).length || 0;
      const callCount = calls?.length || 0;
      const totalLeads = forms + callCount;
      const convRate = sessions > 0 ? (totalLeads / sessions) * 100 : 0;

      // Upsert daily metrics
      const { data: existing } = await supabase
        .from("brandaro_client_metrics")
        .select("id")
        .eq("client_id", client.id)
        .eq("period_date", today)
        .single();

      const metricsData = {
        client_id: client.id,
        period_date: today,
        total_visitors: sessions,
        leads_generated: totalLeads,
        calls_generated: callCount,
        form_submissions: forms,
        cta_clicks: clicks,
        conversion_rate: Math.round(convRate * 100) / 100,
      };

      if (existing) {
        await supabase.from("brandaro_client_metrics").update(metricsData).eq("id", existing.id);
      } else {
        await supabase.from("brandaro_client_metrics").insert(metricsData);
      }

      // Alert: conversion drop detection
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      const { data: weekMetrics } = await supabase
        .from("brandaro_client_metrics")
        .select("conversion_rate")
        .eq("client_id", client.id)
        .gte("period_date", weekAgo)
        .order("period_date", { ascending: true });

      if (weekMetrics && weekMetrics.length >= 3) {
        const avgPrev = weekMetrics.slice(0, -1).reduce((s, m) => s + (m.conversion_rate || 0), 0) / (weekMetrics.length - 1);
        const latest = weekMetrics[weekMetrics.length - 1].conversion_rate || 0;
        if (avgPrev > 0 && latest < avgPrev * 0.5) {
          await supabase.from("brandaro_client_alerts").insert({
            client_id: client.id,
            alert_type: "conversion_drop",
            severity: "critical",
            message: `Conversion rate dropped ${Math.round(((avgPrev - latest) / avgPrev) * 100)}% vs previous week average`,
            details: { previous_avg: avgPrev, current: latest },
          });
        }
      }

      processed++;
    }

    return new Response(JSON.stringify({ ok: true, clients_processed: processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Metrics worker error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
