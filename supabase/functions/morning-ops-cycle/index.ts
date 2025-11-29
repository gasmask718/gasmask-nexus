import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Morning Ops Cycle Edge Function
 * Runs at 8:00 AM - Full morning automation sequence
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errors: string[] = [];
  const results: Record<string, any> = {
    riskScanCompleted: false,
    followUpEngineRan: false,
    playbooksExecuted: 0,
    briefingGenerated: false,
    communicationQueueItems: 0,
    routesRecommended: 0,
    tasksCreated: 0,
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🌅 Morning Ops Cycle: Starting...');

    // Check if morning ops is enabled
    const { data: settings } = await supabase
      .from('ai_follow_up_settings')
      .select('morning_enabled')
      .limit(1)
      .single();

    if (settings && settings.morning_enabled === false) {
      console.log('⏸️ Morning ops disabled, skipping...');
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'Morning ops disabled in settings'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Run Risk Radar Scan
    try {
      console.log('📊 Running Risk Radar Scan...');
      const riskResponse = await fetch(`${supabaseUrl}/functions/v1/ai-risk-scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanType: 'full' }),
      });
      
      if (riskResponse.ok) {
        const riskData = await riskResponse.json();
        results.riskScanCompleted = true;
        results.newRisks = riskData.new_risks || 0;
        console.log(`✅ Risk scan complete: ${riskData.new_risks} new risks`);
      }
    } catch (e) {
      errors.push(`Risk scan failed: ${e}`);
      console.error('❌ Risk scan error:', e);
    }

    // 2. Run Follow-Up Engine
    try {
      console.log('🔄 Running Follow-Up Engine...');
      const followUpResponse = await fetch(`${supabaseUrl}/functions/v1/follow-up-engine`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanType: 'full' }),
      });
      
      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        results.followUpEngineRan = true;
        results.followUpActions = followUpData.actionsTriggered || 0;
        console.log(`✅ Follow-up engine complete: ${followUpData.actionsTriggered} actions`);
      }
    } catch (e) {
      errors.push(`Follow-up engine failed: ${e}`);
      console.error('❌ Follow-up engine error:', e);
    }

    // 3. Run Morning Playbooks
    try {
      console.log('📋 Running morning playbooks...');
      const { data: morningPlaybooks } = await supabase
        .from('ai_playbooks')
        .select('id, title, steps')
        .or('title.ilike.%morning%,description.ilike.%morning%');

      if (morningPlaybooks && morningPlaybooks.length > 0) {
        for (const playbook of morningPlaybooks) {
          await supabase.from('ai_routine_logs').insert({
            playbook_id: playbook.id,
            status: 'completed',
            result: { automated: true, cycle: 'morning' },
          });
          results.playbooksExecuted++;
        }
        console.log(`✅ Executed ${results.playbooksExecuted} morning playbooks`);
      }
    } catch (e) {
      errors.push(`Playbook execution failed: ${e}`);
      console.error('❌ Playbook error:', e);
    }

    // 4. Generate Morning Briefing
    try {
      console.log('📰 Generating morning briefing...');
      const briefingResponse = await fetch(`${supabaseUrl}/functions/v1/daily-briefing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'morning' }),
      });
      
      if (briefingResponse.ok) {
        results.briefingGenerated = true;
        console.log('✅ Morning briefing generated');
      }
    } catch (e) {
      errors.push(`Briefing generation failed: ${e}`);
      console.error('❌ Briefing error:', e);
    }

    // 5. Create urgent communication queue items
    try {
      console.log('📬 Processing urgent items for communication queue...');
      const { data: urgentRisks } = await supabase
        .from('ai_risk_insights')
        .select('id, entity_type, entity_id, headline, risk_level')
        .eq('status', 'open')
        .in('risk_level', ['high', 'critical'])
        .limit(50);

      if (urgentRisks && urgentRisks.length > 0) {
        for (const risk of urgentRisks) {
          // Check if already in queue
          const { data: existing } = await supabase
            .from('ai_communication_queue')
            .select('id')
            .eq('entity_type', risk.entity_type)
            .eq('entity_id', risk.entity_id || risk.id)
            .eq('status', 'pending')
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from('ai_communication_queue').insert({
              entity_type: risk.entity_type,
              entity_id: risk.entity_id || risk.id,
              suggested_action: 'urgent_review',
              reason: risk.headline,
              urgency: risk.risk_level === 'critical' ? 95 : 75,
              status: 'pending',
            });
            results.communicationQueueItems++;
          }
        }
        console.log(`✅ Added ${results.communicationQueueItems} items to communication queue`);
      }
    } catch (e) {
      errors.push(`Communication queue failed: ${e}`);
      console.error('❌ Communication queue error:', e);
    }

    // 6. Create recommended routes for at-risk stores
    try {
      console.log('🗺️ Creating route recommendations...');
      const { data: atRiskStores } = await supabase
        .from('ai_risk_insights')
        .select('entity_id, risk_score, headline, source_data')
        .eq('entity_type', 'store')
        .eq('status', 'open')
        .gte('risk_score', 60)
        .order('risk_score', { ascending: false })
        .limit(20);

      if (atRiskStores && atRiskStores.length > 0) {
        // Create route recommendation
        await supabase.from('ai_recommendations').insert({
          category: 'route',
          title: 'Morning Recovery Route',
          description: `Visit ${atRiskStores.length} at-risk stores today`,
          severity: 'high',
          status: 'pending',
          recommended_action: {
            type: 'create_route',
            stores: atRiskStores.map(s => s.entity_id),
            priority: 'high',
          },
        });
        results.routesRecommended = 1;
        console.log(`✅ Created route recommendation for ${atRiskStores.length} stores`);
      }
    } catch (e) {
      errors.push(`Route recommendation failed: ${e}`);
      console.error('❌ Route recommendation error:', e);
    }

    // 7. Create tasks for unpaid invoices and issues
    try {
      console.log('📝 Creating morning tasks...');
      
      // Unpaid invoices tasks
      const { data: unpaidInvoices } = await supabase
        .from('ai_risk_insights')
        .select('entity_id, headline, risk_score')
        .eq('entity_type', 'invoice')
        .eq('risk_type', 'non_payment')
        .eq('status', 'open')
        .gte('risk_score', 70)
        .limit(10);

      if (unpaidInvoices) {
        for (const invoice of unpaidInvoices) {
          await supabase.from('ai_communication_queue').insert({
            entity_type: 'invoice',
            entity_id: invoice.entity_id,
            suggested_action: 'follow_up_call',
            reason: `High-priority: ${invoice.headline}`,
            urgency: 80,
            status: 'pending',
          });
          results.tasksCreated++;
        }
      }

      // Ambassador inactivity tasks
      const { data: inactiveAmbassadors } = await supabase
        .from('ai_risk_insights')
        .select('entity_id, headline')
        .eq('entity_type', 'ambassador')
        .eq('status', 'open')
        .limit(5);

      if (inactiveAmbassadors) {
        for (const amb of inactiveAmbassadors) {
          await supabase.from('ai_communication_queue').insert({
            entity_type: 'ambassador',
            entity_id: amb.entity_id,
            suggested_action: 'check_in',
            reason: amb.headline,
            urgency: 60,
            status: 'pending',
          });
          results.tasksCreated++;
        }
      }

      console.log(`✅ Created ${results.tasksCreated} morning tasks`);
    } catch (e) {
      errors.push(`Task creation failed: ${e}`);
      console.error('❌ Task creation error:', e);
    }

    // Log the ops cycle
    const duration = Date.now() - startTime;
    await supabase.from('ai_ops_log').insert({
      cycle_type: 'morning',
      results,
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : null,
      notes: `Completed in ${duration}ms`,
    });

    console.log(`🌅 Morning Ops Cycle complete in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      cycle: 'morning',
      duration,
      results,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Morning Ops Cycle Error:', error);
    
    // Try to log the failure
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('ai_ops_log').insert({
        cycle_type: 'morning',
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
