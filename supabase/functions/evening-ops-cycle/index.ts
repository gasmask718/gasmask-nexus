import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Evening Ops Cycle Edge Function
 * Runs at 8:00 PM - End of day wrap-up and tomorrow prep
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errors: string[] = [];
  const results: Record<string, any> = {
    finalRiskSweep: false,
    actionsLoggedToday: 0,
    playbooksExecuted: 0,
    briefingGenerated: false,
    tomorrowTasksCreated: 0,
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🌙 Evening Ops Cycle: Starting...');

    // Check if evening ops is enabled
    const { data: settings } = await supabase
      .from('ai_follow_up_settings')
      .select('evening_enabled')
      .limit(1)
      .single();

    if (settings && settings.evening_enabled === false) {
      console.log('⏸️ Evening ops disabled, skipping...');
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'Evening ops disabled in settings'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00.000Z`;

    // 1. Final risk sweep
    try {
      console.log('📊 Running final risk sweep...');
      const riskResponse = await fetch(`${supabaseUrl}/functions/v1/ai-risk-scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanType: 'full' }),
      });
      
      if (riskResponse.ok) {
        results.finalRiskSweep = true;
        console.log('✅ Final risk sweep complete');
      }
    } catch (e) {
      errors.push(`Final risk sweep failed: ${e}`);
      console.error('❌ Risk sweep error:', e);
    }

    // 2. Log all automated actions from today
    try {
      console.log('📝 Logging today\'s automated actions...');
      const { data: todayActions, count } = await supabase
        .from('ai_follow_up_log')
        .select('*', { count: 'exact' })
        .gte('created_at', todayStart);

      results.actionsLoggedToday = count || 0;
      
      // Aggregate by action type
      if (todayActions) {
        const actionSummary: Record<string, number> = {};
        for (const action of todayActions) {
          const type = action.action_category || action.action_taken || 'other';
          actionSummary[type] = (actionSummary[type] || 0) + 1;
        }
        results.actionSummary = actionSummary;
      }
      
      console.log(`✅ Logged ${results.actionsLoggedToday} actions from today`);
    } catch (e) {
      errors.push(`Action logging failed: ${e}`);
      console.error('❌ Action logging error:', e);
    }

    // 3. Run Evening Playbooks
    try {
      console.log('📋 Running evening playbooks...');
      const { data: eveningPlaybooks } = await supabase
        .from('ai_playbooks')
        .select('id, title, steps')
        .or('title.ilike.%evening%,title.ilike.%night%,description.ilike.%evening%');

      if (eveningPlaybooks && eveningPlaybooks.length > 0) {
        for (const playbook of eveningPlaybooks) {
          await supabase.from('ai_routine_logs').insert({
            playbook_id: playbook.id,
            status: 'completed',
            result: { automated: true, cycle: 'evening' },
          });
          results.playbooksExecuted++;
        }
        console.log(`✅ Executed ${results.playbooksExecuted} evening playbooks`);
      }
    } catch (e) {
      errors.push(`Playbook execution failed: ${e}`);
      console.error('❌ Playbook error:', e);
    }

    // 4. Generate Evening Briefing
    try {
      console.log('📰 Generating evening briefing...');
      const briefingResponse = await fetch(`${supabaseUrl}/functions/v1/daily-briefing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'evening' }),
      });
      
      if (briefingResponse.ok) {
        results.briefingGenerated = true;
        console.log('✅ Evening briefing generated');
      }
    } catch (e) {
      errors.push(`Briefing generation failed: ${e}`);
      console.error('❌ Briefing error:', e);
    }

    // 5. Create "tomorrow prep" tasks
    try {
      console.log('📝 Creating tomorrow prep tasks...');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Get high-priority open risks for tomorrow
      const { data: openRisks } = await supabase
        .from('ai_risk_insights')
        .select('id, entity_type, entity_id, headline, risk_level, risk_score')
        .eq('status', 'open')
        .in('risk_level', ['high', 'critical'])
        .order('risk_score', { ascending: false })
        .limit(10);

      if (openRisks) {
        for (const risk of openRisks) {
          await supabase.from('ai_communication_queue').insert({
            entity_type: risk.entity_type,
            entity_id: risk.entity_id || risk.id,
            suggested_action: 'tomorrow_priority',
            reason: `Tomorrow: ${risk.headline}`,
            urgency: risk.risk_level === 'critical' ? 90 : 70,
            status: 'pending',
          });
          results.tomorrowTasksCreated++;
        }
        console.log(`✅ Created ${results.tomorrowTasksCreated} tasks for tomorrow`);
      }

      // Create tomorrow's route recommendation
      const { data: storesNeedingVisit } = await supabase
        .from('ai_risk_insights')
        .select('entity_id')
        .eq('entity_type', 'store')
        .eq('status', 'open')
        .gte('risk_score', 50)
        .limit(15);

      if (storesNeedingVisit && storesNeedingVisit.length > 0) {
        await supabase.from('ai_recommendations').insert({
          category: 'route',
          title: `Tomorrow's Priority Route (${tomorrowStr})`,
          description: `Visit ${storesNeedingVisit.length} stores that need attention`,
          severity: 'medium',
          status: 'pending',
          recommended_action: {
            type: 'create_route',
            date: tomorrowStr,
            stores: storesNeedingVisit.map(s => s.entity_id),
          },
        });
        results.tomorrowRouteRecommendation = true;
      }
    } catch (e) {
      errors.push(`Tomorrow prep failed: ${e}`);
      console.error('❌ Tomorrow prep error:', e);
    }

    // 6. Create day summary stats
    try {
      console.log('📊 Creating day summary...');
      
      // Count today's activities
      const { count: followUpsToday } = await supabase
        .from('ai_follow_up_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart);

      const { count: queueItemsHandled } = await supabase
        .from('ai_communication_queue')
        .select('*', { count: 'exact', head: true })
        .gte('actioned_at', todayStart)
        .not('actioned_at', 'is', null);

      const { count: openRisks } = await supabase
        .from('ai_risk_insights')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      results.daySummary = {
        followUpsToday: followUpsToday || 0,
        queueItemsHandled: queueItemsHandled || 0,
        openRisksRemaining: openRisks || 0,
      };

      console.log('✅ Day summary created');
    } catch (e) {
      errors.push(`Day summary failed: ${e}`);
      console.error('❌ Day summary error:', e);
    }

    // Log the ops cycle
    const duration = Date.now() - startTime;
    await supabase.from('ai_ops_log').insert({
      cycle_type: 'evening',
      results,
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : null,
      notes: `Completed in ${duration}ms`,
    });

    console.log(`🌙 Evening Ops Cycle complete in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      cycle: 'evening',
      duration,
      results,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Evening Ops Cycle Error:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('ai_ops_log').insert({
        cycle_type: 'evening',
        results,
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        notes: 'Cycle failed with critical error',
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
