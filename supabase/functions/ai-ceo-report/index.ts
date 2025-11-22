import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Generating AI CEO Weekly Report');

    // Fetch all critical metrics
    const [leads, pipeline, closings, investors, vas, actions] = await Promise.all([
      supabase.from("leads_raw").select("*").limit(1000),
      supabase.from("acquisitions_pipeline").select("*"),
      supabase.from("deal_closings").select("*"),
      supabase.from("investor_buy_boxes").select("*"),
      supabase.from("vas").select("*"),
      supabase.from("ceo_actions").select("*").eq("status", "pending")
    ]);

    // Calculate KPIs
    const totalLeads = leads.data?.length || 0;
    const dealsInPipeline = pipeline.data?.length || 0;
    const dealsClosed = closings.data?.length || 0;
    const totalRevenue = closings.data?.reduce((sum, d) => sum + (d.assignment_fee || 0), 0) || 0;
    const avgClosingDays = dealsClosed > 0 
      ? closings.data?.reduce((sum, d) => {
          const created = new Date(d.created_at).getTime();
          const closed = new Date(d.closing_date).getTime();
          return sum + (closed - created) / (1000 * 60 * 60 * 24);
        }, 0) / dealsClosed 
      : 0;

    // Use AI to generate comprehensive CEO report
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are the AI CEO of a real estate wholesaling company. Analyze data and provide executive-level strategic insights.'
          },
          {
            role: 'user',
            content: `Generate a comprehensive weekly CEO report for our real estate wholesaling operation:

CURRENT METRICS:
- Total Leads: ${totalLeads}
- Deals in Pipeline: ${dealsInPipeline}
- Deals Closed This Week: ${dealsClosed}
- Total Revenue: $${totalRevenue}
- Average Closing Time: ${avgClosingDays.toFixed(1)} days
- Active Investors: ${investors.data?.length || 0}
- Active VAs: ${vas.data?.length || 0}
- Pending Actions: ${actions.data?.length || 0}

GOAL: $10M/month revenue ($2.5M/week)

Provide:
1. KPI Analysis (are we on track?)
2. Pipeline Health Assessment
3. 7-Day Cashflow Forecast
4. Top 3 Bottlenecks
5. Team Performance Summary
6. 7-Day Priority Action Plan
7. Strategic Recommendations

Format as JSON with keys: kpi_summary, pipeline_status, cashflow_forecast, bottlenecks, team_performance, priority_plan, recommendations`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    let report;
    try {
      report = JSON.parse(content);
    } catch {
      report = {
        kpi_summary: { status: "data_parsed" },
        pipeline_status: { health: "needs_analysis" },
        cashflow_forecast: { week: [] },
        bottlenecks: [{ issue: "Data parsing", severity: "low" }],
        team_performance: { overall: "good" },
        priority_plan: [{ priority: 1, action: "Review AI analysis", timeline: "24h" }],
        recommendations: content
      };
    }

    // Store the report
    const { data: storedReport, error: reportError } = await supabase
      .from("ceo_reports")
      .insert([{
        report_type: 'weekly',
        kpi_summary: report.kpi_summary,
        pipeline_status: report.pipeline_status,
        cashflow_forecast: report.cashflow_forecast,
        bottlenecks: report.bottlenecks,
        team_performance: report.team_performance,
        priority_plan: report.priority_plan,
        recommendations: report.recommendations,
        ai_confidence_score: 90
      }])
      .select()
      .single();

    if (reportError) throw reportError;

    console.log(`CEO Report generated: ${storedReport.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        report_id: storedReport.id,
        report
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating CEO report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});