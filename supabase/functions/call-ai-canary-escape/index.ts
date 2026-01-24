import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EscapeRequest {
  session_id: string;
  business_id: string;
  escape_type: 'human_takeover' | 'caller_keyword' | 'timeout' | 'sentiment_drop' | 'confidence_drop' | 'admin_kill_switch' | 'system_error';
  escape_trigger?: string;
  escape_details?: Record<string, any>;
  override_user_id?: string;
  override_reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const startTime = Date.now();
    const body: EscapeRequest = await req.json();
    const { 
      session_id, 
      business_id, 
      escape_type, 
      escape_trigger, 
      escape_details,
      override_user_id,
      override_reason
    } = body;

    console.log(`🚨 Canary Escape triggered: ${escape_type} for session ${session_id}`);

    // 1. Get the canary log entry
    const { data: canaryLog } = await supabase
      .from('canary_call_log')
      .select('*')
      .eq('session_id', session_id)
      .is('outcome', null)
      .single();

    // 2. Update session to human_active immediately
    await supabase
      .from('ai_call_sessions')
      .update({
        status: 'human_active',
        handoff_state: 'human_active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    const handoffCompletedAt = new Date().toISOString();
    const resolutionLatency = Date.now() - startTime;

    // 3. Map escape type to outcome
    let outcome: string;
    switch (escape_type) {
      case 'human_takeover':
        outcome = 'handoff';
        break;
      case 'caller_keyword':
        outcome = 'caller_requested_human';
        break;
      case 'timeout':
        outcome = 'timeout';
        break;
      case 'sentiment_drop':
        outcome = 'sentiment_drop';
        break;
      case 'confidence_drop':
      case 'admin_kill_switch':
      case 'system_error':
        outcome = 'failure';
        break;
      default:
        outcome = 'handoff';
    }

    // 4. Update canary log with outcome
    if (canaryLog) {
      const aiActiveDuration = canaryLog.created_at 
        ? Math.round((Date.now() - new Date(canaryLog.created_at).getTime()) / 1000)
        : 0;

      await supabase
        .from('canary_call_log')
        .update({
          outcome,
          outcome_reason: escape_trigger || escape_type,
          handoff_requested_at: new Date(startTime).toISOString(),
          handoff_completed_at: handoffCompletedAt,
          handoff_latency_ms: resolutionLatency,
          ai_active_duration_seconds: aiActiveDuration,
          human_overrode: escape_type === 'human_takeover',
          override_user_id,
          override_reason,
          updated_at: handoffCompletedAt,
        })
        .eq('id', canaryLog.id);

      // 5. Create escape event record
      await supabase.from('canary_escape_events').insert({
        canary_log_id: canaryLog.id,
        session_id,
        business_id,
        escape_type,
        escape_trigger,
        escape_details: escape_details || {},
        triggered_at: new Date(startTime).toISOString(),
        resolved_at: handoffCompletedAt,
        resolution_latency_ms: resolutionLatency,
        was_successful: true,
      });
    }

    // 6. Log tone event for audit trail
    await supabase.from('ai_call_tone_events').insert({
      session_id,
      old_tone: 'ai_canary',
      new_tone: 'human_controlled',
      reason: `Canary escape: ${escape_type} - ${escape_trigger || 'No trigger specified'}`,
    });

    // 7. If this is a failure-type escape, log it for trust scoring
    if (['confidence_drop', 'admin_kill_switch', 'system_error', 'sentiment_drop'].includes(escape_type)) {
      await supabase.from('ai_agent_failures').insert({
        business_id,
        failure_type: `canary_${escape_type}`,
        failure_reason: escape_trigger || escape_type,
        was_escalated: true,
      });

      // Check if we need to auto-downgrade
      const { data: config } = await supabase
        .from('ai_call_agent_config')
        .select('auto_downgrade_on_failure, max_consecutive_failures')
        .eq('business_id', business_id)
        .single();

      const { data: recentFailures } = await supabase
        .from('canary_call_log')
        .select('id')
        .eq('business_id', business_id)
        .in('outcome', ['failure', 'timeout', 'sentiment_drop'])
        .order('created_at', { ascending: false })
        .limit(config?.max_consecutive_failures || 3);

      if (config?.auto_downgrade_on_failure && 
          recentFailures && 
          recentFailures.length >= (config.max_consecutive_failures || 3)) {
        // Auto-downgrade to assisted mode
        await supabase
          .from('ai_call_agent_config')
          .update({ 
            mode: 'assisted',
            updated_at: new Date().toISOString(),
          })
          .eq('business_id', business_id);

        await supabase
          .from('ai_trust_scores')
          .update({
            current_mode: 'assisted',
            demoted_at: new Date().toISOString(),
          })
          .eq('business_id', business_id)
          .is('route_id', null);

        console.log(`⬇️ Auto-downgraded business ${business_id} to assisted mode due to consecutive failures`);
      }
    }

    console.log(`✅ Canary Escape completed in ${resolutionLatency}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        escape_type,
        outcome,
        resolution_latency_ms: resolutionLatency,
        session_status: 'human_active',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Canary Escape Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
