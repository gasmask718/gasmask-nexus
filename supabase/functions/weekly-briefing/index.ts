import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const sevenDaysAgoDate = sevenDaysAgo.split('T')[0];

    const [
      storeCount,
      tasksCreated,
      tasksCompleted,
      alertsOpen,
      notesClean,
      checklistVisits,
      healthTop,
      healthBottom,
      instinctCount,
    ] = await Promise.all([
      supabase.from('store_master').select('*', { count: 'exact', head: true }),
      supabase.from('ai_work_tasks').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      supabase.from('ai_work_tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', sevenDaysAgo),
      supabase.from('ai_drift_alerts').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('store_notes').select('*', { count: 'exact', head: true }).eq('cleaning_status', 'approved'),
      supabase.from('checklist_tube_intelligence').select('store_id, interest, tube_count, product_name').gte('visit_date', sevenDaysAgoDate),
      supabase.from('store_health_scores').select('store_id, overall_score, health_status').order('overall_score', { ascending: false }).limit(5),
      supabase.from('store_health_scores').select('store_id, overall_score, health_status').order('overall_score', { ascending: true }).limit(5),
      supabase.from('ai_instinct_log').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    ]);

    // Enrich stores with names
    const topIds = (healthTop.data || []).map((s: any) => s.store_id);
    const botIds = (healthBottom.data || []).map((s: any) => s.store_id);
    const allIds = [...new Set([...topIds, ...botIds])];
    
    let nameMap: Record<string, string> = {};
    if (allIds.length > 0) {
      const { data: storeNames } = await supabase.from('store_master').select('id, store_name').in('id', allIds);
      nameMap = Object.fromEntries((storeNames || []).map((s: any) => [s.id, s.store_name]));
    }

    const topStores = (healthTop.data || []).map((s: any) => ({
      name: nameMap[s.store_id] || 'Unknown',
      score: s.overall_score,
      status: s.health_status,
    }));

    const bottomStores = (healthBottom.data || []).map((s: any) => ({
      name: nameMap[s.store_id] || 'Unknown',
      score: s.overall_score,
      status: s.health_status,
    }));

    // Product summary
    const productMap: Record<string, { tubes: number; interested: number }> = {};
    for (const item of checklistVisits.data || []) {
      if (!item.product_name) continue;
      if (!productMap[item.product_name]) productMap[item.product_name] = { tubes: 0, interested: 0 };
      productMap[item.product_name].tubes += item.tube_count || 0;
      if (item.interest === 'Interested') productMap[item.product_name].interested++;
    }

    const weeklyData = {
      total_stores: storeCount.count,
      tasks_created_this_week: tasksCreated.count,
      tasks_completed_this_week: tasksCompleted.count,
      open_alerts: alertsOpen.count,
      notes_cleaned_total: notesClean.count,
      store_visits_this_week: new Set((checklistVisits.data || []).map((v: any) => v.store_id)).size,
      interested_signals_this_week: (checklistVisits.data || []).filter((v: any) => v.interest === 'Interested').length,
      ai_actions_this_week: instinctCount.count,
      top_stores: topStores,
      bottom_stores: bottomStores,
      product_summary: productMap,
    };

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `You are the Dynasty OS Intelligence Director. Write a concise, professional weekly briefing for David Sutherland, founder of Dynasty OS — a multi-brand tobacco/grabba retail platform with ${weeklyData.total_stores} stores in New York/New Jersey.

Be specific with real numbers. Be direct. Highlight what needs immediate action. Format in these exact sections:

EXECUTIVE SUMMARY
(2-3 sentences)

TOP PERFORMING STORES
(list top stores by health score)

STORES NEEDING ATTENTION
(bottom stores needing immediate action)

PRODUCT HIGHLIGHTS
(which products had the most activity/issues)

AI ACTIVITY THIS WEEK
(what the AI system accomplished automatically)

THIS WEEK'S TOP PRIORITIES
(numbered list of 5 specific actions)

Keep each section tight. Use real numbers. Sound like a sharp operations director briefing the CEO.`,
        messages: [{
          role: 'user',
          content: `Weekly data:\n${JSON.stringify(weeklyData, null, 2)}\n\nWrite the Dynasty OS Weekly Intelligence Briefing.`,
        }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`Anthropic API error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const briefingText = aiData.content?.[0]?.text?.trim() || 'Unable to generate briefing.';

    const { data: savedBriefing } = await supabase
      .from('weekly_briefings')
      .insert({
        briefing_text: briefingText,
        metrics_snapshot: weeklyData,
        week_start: sevenDaysAgoDate,
        week_end: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    await supabase.from('ai_instinct_log').insert({
      action_type: 'weekly_briefing_generated',
      reasoning: `Generated weekly briefing covering ${weeklyData.total_stores} stores, ${weeklyData.tasks_created_this_week} tasks, ${weeklyData.ai_actions_this_week} AI actions`,
      decision_path: { agent: 'Weekly Briefing Agent', metrics: weeklyData },
      confidence_score: 1.0,
    });

    return new Response(JSON.stringify({ briefing: briefingText, metrics: weeklyData, id: savedBriefing?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Weekly briefing error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
