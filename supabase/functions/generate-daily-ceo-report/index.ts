import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

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

    console.log('Generating daily CEO report...');

    // Get yesterday's and today's data for comparison
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    // Fetch comprehensive data
    const [
      { data: todayVisits },
      { data: yesterdayVisits },
      { data: todayOrders },
      { data: yesterdayOrders },
      { data: todayComms },
      { data: todayAutomations },
      { data: stores },
      { data: routes },
      { data: recommendations },
    ] = await Promise.all([
      supabase.from('visit_logs').select('cash_collected').gte('visit_datetime', startOfToday.toISOString()),
      supabase.from('visit_logs').select('cash_collected').gte('visit_datetime', startOfYesterday.toISOString()).lt('visit_datetime', startOfToday.toISOString()),
      supabase.from('wholesale_orders').select('*').gte('created_at', startOfToday.toISOString()),
      supabase.from('wholesale_orders').select('*').gte('created_at', startOfYesterday.toISOString()).lt('created_at', startOfToday.toISOString()),
      supabase.from('communication_logs').select('*').gte('created_at', startOfToday.toISOString()),
      supabase.from('automation_logs').select('status').gte('created_at', startOfToday.toISOString()),
      supabase.from('stores').select('*'),
      supabase.from('routes').select('*').gte('date', startOfToday.toISOString().split('T')[0]),
      supabase.from('ai_recommendations').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
    ]);

    // Calculate metrics
    const todayRevenue = todayVisits?.reduce((sum, v) => sum + (v.cash_collected || 0), 0) || 0;
    const yesterdayRevenue = yesterdayVisits?.reduce((sum, v) => sum + (v.cash_collected || 0), 0) || 0;
    const revenueChange = todayRevenue - yesterdayRevenue;
    const revenueChangePercent = yesterdayRevenue > 0 ? ((revenueChange / yesterdayRevenue) * 100).toFixed(1) : '0';

    const activeStores = stores?.filter(s => s.status === 'active').length || 0;
    const inactiveStores = stores?.filter(s => s.status === 'inactive').length || 0;

    // Prepare data for AI
    const reportData = {
      revenue: {
        today: todayRevenue,
        yesterday: yesterdayRevenue,
        change: revenueChange,
        changePercent: revenueChangePercent,
      },
      orders: {
        today: todayOrders?.length || 0,
        yesterday: yesterdayOrders?.length || 0,
      },
      stores: {
        active: activeStores,
        inactive: inactiveStores,
        total: stores?.length || 0,
      },
      routes: {
        scheduled: routes?.length || 0,
        completed: routes?.filter(r => r.status === 'completed').length || 0,
      },
      communications: {
        total: todayComms?.length || 0,
        byChannel: todayComms?.reduce((acc: any, c) => {
          acc[c.channel] = (acc[c.channel] || 0) + 1;
          return acc;
        }, {}),
      },
      automations: {
        triggered: todayAutomations?.length || 0,
        successful: todayAutomations?.filter(a => a.status === 'success').length || 0,
        failed: todayAutomations?.filter(a => a.status === 'failed').length || 0,
      },
      aiRecommendations: recommendations || [],
    };

    // Generate AI report
    const prompt = `You are the Dynasty OS AI CEO Assistant. Generate a comprehensive daily CEO report.

TODAY'S DATA:
${JSON.stringify(reportData, null, 2)}

Generate a report with:
1. Executive Summary (what happened today)
2. Revenue Analysis (changes, trends, concerns)
3. What Changed (significant changes from yesterday)
4. What Broke (issues, failures, problems)
5. What Grew (positive trends, wins)
6. What Needs Action (urgent priorities)
7. Brand-by-Brand Notes (insights per brand if applicable)
8. Driver/Biker Performance Summary
9. Store Performance Rating (top/bottom performers)
10. AI Predictions (what to expect tomorrow/this week)

Return JSON:
{
  "executiveSummary": "...",
  "revenueSnapshot": {...},
  "changesSummary": [...],
  "issues": [...],
  "growthAreas": [...],
  "actionItems": [...],
  "brandInsights": {...},
  "performanceSummary": {...},
  "aiPredictions": {...}
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a CEO AI assistant. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    // Save report
    const { data: report, error } = await supabase
      .from('ceo_reports')
      .insert({
        report_date: today.toISOString().split('T')[0],
        report_type: 'daily',
        revenue_snapshot: analysis.revenueSnapshot,
        changes_summary: analysis.changesSummary,
        issues: analysis.issues,
        growth_areas: analysis.growthAreas,
        action_items: analysis.actionItems,
        brand_insights: analysis.brandInsights,
        performance_summary: analysis.performanceSummary,
        ai_predictions: analysis.aiPredictions,
        generated_by: 'ai',
      })
      .select()
      .single();

    if (error) throw error;

    console.log('CEO report generated:', report.id);

    return new Response(JSON.stringify({
      success: true,
      reportId: report.id,
      report: analysis,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating CEO report:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});