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

    const { client_id, dry_run } = await req.json();

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client
    const { data: client } = await supabase
      .from("brandaro_clients")
      .select("*")
      .eq("id", client_id)
      .single();
    if (!client) throw new Error("Client not found");

    // Get current month metrics
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

    const { data: currentMetrics } = await supabase
      .from("brandaro_client_metrics")
      .select("*")
      .eq("client_id", client_id)
      .gte("period_date", monthStart);

    const { data: prevMetrics } = await supabase
      .from("brandaro_client_metrics")
      .select("*")
      .eq("client_id", client_id)
      .gte("period_date", prevMonthStart)
      .lte("period_date", prevMonthEnd);

    // Aggregate
    const agg = (data: any[]) => ({
      visitors: data?.reduce((s, m) => s + (m.total_visitors || 0), 0) || 0,
      leads: data?.reduce((s, m) => s + (m.leads_generated || 0), 0) || 0,
      calls: data?.reduce((s, m) => s + (m.calls_generated || 0), 0) || 0,
      forms: data?.reduce((s, m) => s + (m.form_submissions || 0), 0) || 0,
    });

    const current = agg(currentMetrics || []);
    const prev = agg(prevMetrics || []);

    const growthPct = (curr: number, previous: number) => {
      if (previous === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - previous) / previous) * 100);
    };

    // Get optimization tasks completed this month
    const { data: completedOpts } = await supabase
      .from("brandaro_optimization_tasks")
      .select("id, task_type, suggested_value")
      .eq("client_id", client_id)
      .eq("status", "applied")
      .gte("applied_at", monthStart);

    const report = {
      client_name: client.business_name,
      period: `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`,
      current_month: current,
      previous_month: prev,
      growth: {
        visitors: growthPct(current.visitors, prev.visitors),
        leads: growthPct(current.leads, prev.leads),
        calls: growthPct(current.calls, prev.calls),
      },
      improvements_made: completedOpts?.length || 0,
      conversion_rate: current.visitors > 0 ? ((current.leads / current.visitors) * 100).toFixed(1) : "0",
    };

    // Send SMS report if client has phone
    if (client.phone) {
      const reportMsg = `📊 ${client.business_name} - ${report.period} Report\n\n` +
        `👥 Visitors: ${current.visitors} (${report.growth.visitors > 0 ? "+" : ""}${report.growth.visitors}%)\n` +
        `📩 Leads: ${current.leads} (${report.growth.leads > 0 ? "+" : ""}${report.growth.leads}%)\n` +
        `📞 Calls: ${current.calls} (${report.growth.calls > 0 ? "+" : ""}${report.growth.calls}%)\n` +
        `📈 Conversion: ${report.conversion_rate}%\n` +
        `🔧 Improvements: ${report.improvements_made}\n\n` +
        `Your website is working for you! — Brandaro Digital`;

      // Store for SMS sending
      await supabase.from("brandaro_sms_queue").insert({
        phone: client.phone,
        message: reportMsg,
        lead_id: client.lead_id,
        sms_type: "monthly_report",
        status: "pending",
      }).then(() => {}).catch(() => {});
    }

    // Update last report sent
    await supabase.from("brandaro_projects")
      .update({ last_report_sent_at: new Date().toISOString() })
      .eq("client_id", client_id);

    return new Response(JSON.stringify({ ok: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Monthly report error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
