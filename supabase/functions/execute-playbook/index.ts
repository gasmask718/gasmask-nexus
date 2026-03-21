import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { playbook_id, trigger_data, store_id, lead_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: playbook, error: pbErr } = await supabase
      .from('communication_playbooks')
      .select('*')
      .eq('id', playbook_id)
      .single();

    if (pbErr || !playbook) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (playbook.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Playbook is not active' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context
    let context: Record<string, any> = {
      today: new Date().toLocaleDateString(),
      greeting_arabic: 'Salam alaikum',
      greeting_english: new Date().getHours() < 12 ? 'Good morning' : 'Good afternoon',
      greeting_spanish: 'Buenos días',
      ...trigger_data,
    };

    if (store_id) {
      const { data: store } = await supabase
        .from('store_master')
        .select('store_name, phone, city, state')
        .eq('id', store_id)
        .single();
      if (store) Object.assign(context, { store_name: store.store_name, phone: store.phone, city: store.city, state: store.state });
    }

    if (lead_id) {
      const { data: lead } = await supabase
        .from('outreach_leads')
        .select('store_name, contact_name, phone, language_detected, lead_score, phone_type')
        .eq('id', lead_id)
        .single();
      if (lead) Object.assign(context, lead);
    }

    // Check conditions
    const conditions = playbook.conditions || [];
    const failedConditions: any[] = [];
    for (const cond of conditions) {
      const key = cond.type.replace(/_is$/, '').replace(/_above$/, '').replace(/_below$/, '');
      const value = context[key];
      let passed = true;
      if (cond.operator === 'equals' && String(value) !== String(cond.value)) passed = false;
      if (cond.operator === 'not_equals' && String(value) === String(cond.value)) passed = false;
      if (cond.operator === 'greater_than' && Number(value) <= Number(cond.value)) passed = false;
      if (cond.operator === 'less_than' && Number(value) >= Number(cond.value)) passed = false;
      if (!passed) failedConditions.push(cond);
    }

    // Create execution
    const { data: execution } = await supabase
      .from('playbook_executions')
      .insert({
        playbook_id,
        triggered_by: trigger_data?.trigger_type || 'manual',
        trigger_data,
        conditions_passed: failedConditions.length === 0,
        conditions_failed: failedConditions,
        status: failedConditions.length > 0 ? 'cancelled' : 'running',
        store_id: store_id || null,
        lead_id: lead_id || null,
      })
      .select()
      .single();

    if (failedConditions.length > 0) {
      return new Response(JSON.stringify({ success: false, reason: 'Conditions not met', failed_conditions: failedConditions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute actions
    const actions = playbook.actions || [];
    const executedActions: any[] = [];
    const failedActions: any[] = [];

    for (const action of actions) {
      try {
        const cfg = resolveVars(action.config || {}, context);

        switch (action.type) {
          case 'send_sms': {
            if (!context.phone) { failedActions.push({ action: action.type, reason: 'No phone' }); break; }
            await supabase.functions.invoke('send-sms', {
              body: { to_number: context.phone, message_body: resolveStr(cfg.template || '', context), idempotency_key: `pb-${playbook_id}-${Date.now()}` },
            });
            executedActions.push({ type: 'send_sms', result: 'sent' });
            break;
          }
          case 'queue_elevenlabs_call':
          case 'queue_auto_dialer': {
            if (lead_id) {
              await supabase.from('outreach_leads').update({ status: 'queued', updated_at: new Date().toISOString() }).eq('id', lead_id);
            }
            executedActions.push({ type: action.type, result: 'queued' });
            break;
          }
          case 'create_ai_task': {
            await supabase.from('ai_work_tasks').insert({
              task_title: resolveStr(cfg.title || '', context),
              task_details: resolveStr(cfg.details || '', context),
              status: 'pending',
              priority: cfg.priority || 'medium',
              task_type: 'playbook_action',
              department: cfg.department || 'sales',
              input_data: { store_id, lead_id, playbook_id, playbook_name: playbook.name },
            });
            executedActions.push({ type: 'create_ai_task', result: 'created' });
            break;
          }
          case 'create_ai_alert': {
            await supabase.from('ai_drift_alerts').insert({
              alert_type: cfg.alert_type || 'playbook_triggered',
              severity: cfg.severity || 'warning',
              message: resolveStr(cfg.message || '', context),
              status: 'open',
              metadata: { store_id, lead_id, playbook_id },
            });
            executedActions.push({ type: 'create_ai_alert', result: 'created' });
            break;
          }
          case 'schedule_followup': {
            const date = new Date(Date.now() + (cfg.days_from_now || 1) * 86400000).toISOString();
            await supabase.from('outreach_calls').insert({
              lead_id: lead_id || null,
              outcome: 'callback',
              callback_date: date,
              notes: resolveStr(cfg.notes || '', context),
            });
            executedActions.push({ type: 'schedule_followup', result: 'scheduled' });
            break;
          }
          case 'update_lead_status': {
            if (lead_id) {
              await supabase.from('outreach_leads').update({ status: cfg.new_status, updated_at: new Date().toISOString() }).eq('id', lead_id);
            }
            executedActions.push({ type: 'update_lead_status', result: cfg.new_status });
            break;
          }
          case 'wait': {
            const ms = Math.min((cfg.duration_value || 1) * (cfg.duration_unit === 'days' ? 86400000 : cfg.duration_unit === 'hours' ? 3600000 : 60000), 25000);
            await new Promise(r => setTimeout(r, ms));
            executedActions.push({ type: 'wait', result: 'completed' });
            break;
          }
        }
      } catch (err: any) {
        failedActions.push({ action: action.type, error: err.message });
      }
    }

    // Finalize
    await supabase.from('playbook_executions').update({
      actions_executed: executedActions,
      actions_failed: failedActions,
      status: failedActions.length === 0 ? 'completed' : 'completed_with_errors',
      completed_at: new Date().toISOString(),
    }).eq('id', execution?.id);

    await supabase.from('communication_playbooks').update({
      run_count: (playbook.run_count || 0) + 1,
      last_triggered_at: new Date().toISOString(),
      last_run_result: failedActions.length === 0 ? 'success' : `${failedActions.length} failed`,
    }).eq('id', playbook_id);

    await supabase.from('ai_instinct_log').insert({
      action_type: 'playbook_executed',
      reasoning: `Playbook "${playbook.name}" — ${executedActions.length} actions`,
      input_data: { playbook_id, trigger_data },
      decision_path: { executed: executedActions, failed: failedActions },
      confidence_score: 1.0,
    });

    return new Response(JSON.stringify({
      success: true,
      execution_id: execution?.id,
      actions_executed: executedActions,
      actions_failed: failedActions,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('Playbook error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function resolveStr(t: string, ctx: Record<string, any>): string {
  return t.replace(/\{\{(\w+)\}\}/g, (_, k) => String(ctx[k] ?? ''));
}

function resolveVars(obj: any, ctx: Record<string, any>): any {
  if (typeof obj === 'string') return resolveStr(obj, ctx);
  if (typeof obj === 'object' && obj !== null) {
    const r: any = {};
    for (const [k, v] of Object.entries(obj)) r[k] = resolveVars(v, ctx);
    return r;
  }
  return obj;
}
