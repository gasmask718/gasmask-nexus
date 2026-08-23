import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { outreachAllowed } from '../_shared/outreachGate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRANDS = ['GasMask', 'Hot Mama Grabba', 'Grabba R Us', 'Hot Scalatti'];

const BRAND_CONTEXT: Record<string, string> = {
  'GasMask': 'GasMask is a tobacco and grabba leaf distribution brand. Products: grabba leaf, cigars, tobacco accessories. Target: corner stores, smoke shops, bodegas in NY/NJ metro area.',
  'Hot Mama Grabba': 'Hot Mama Grabba is a premium female-targeted grabba brand. Products: flavored grabba leaf, premium packaging. Target: beauty supply stores, salons, female-owned bodegas.',
  'Grabba R Us': 'Grabba R Us is a wholesale grabba brand targeting high-volume buyers. Products: bulk grabba, wholesale cases. Target: wholesalers, large retailers, distributors.',
  'Hot Scalatti': 'Hot Scalatti is a new premium brand in launch phase. Products: premium grabba, luxury packaging. Target: upscale smoke shops, lounges.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  const callClaude = async (system: string, user: string, model = 'claude-haiku-4-5-20251001', maxTokens = 1000) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || '';
  };

  const parseJSON = (text: string) => {
    try {
      const match = text.match(/[\[{][\s\S]*[\]}]/);
      return JSON.parse(match?.[0] || '{}');
    } catch {
      return {};
    }
  };

  const fireVisitTrigger = async (payload: Record<string, unknown>) => {
    await supabase.functions.invoke('gasmask-route-agent', {
      body: { action: 'create_trigger', ...payload },
    });
  };

  const saveInsight = async (
    agentName: string, brand: string, insightType: string,
    title: string, body: string, priority = 'normal',
    actionRequired = false, relatedStore?: string
  ) => {
    await supabase.from('dynasty_agent_insights').insert({
      agent_name: agentName, brand, insight_type: insightType,
      title, body, priority, action_required: actionRequired,
      related_store: relatedStore,
    });
  };

  try {
    const body = await req.json().catch(() => ({}));
    const agentName = body.agent_name;

    if (!agentName) {
      return new Response(JSON.stringify({ error: 'agent_name required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create run log
    const { data: run } = await supabase
      .from('dynasty_agent_runs')
      .insert({ agent_name: agentName, status: 'running' })
      .select().single();

    const runId = run?.id;
    let actionsCount = 0;
    let insightsCount = 0;
    let triggersCount = 0;
    let summary = '';

    // ═══════════════════════════════
    // CEO BRIEFING AGENT
    // ═══════════════════════════════
    if (agentName === 'CEO Briefing Agent') {
      const [{ data: leads }, { data: accounts }, { data: triggers }, { data: insights }] = await Promise.all([
        supabase.from('brandaro_qualified_leads').select('pipeline_stage, priority_score').gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('brandaro_qualified_leads').select('pipeline_stage').eq('pipeline_stage', 'closed').gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('gasmask_visit_triggers').select('urgency, trigger_type, store_name').eq('status', 'pending'),
        supabase.from('dynasty_agent_insights').select('*').eq('action_required', true).eq('action_taken', false).eq('dismissed', false).order('created_at', { ascending: false }).limit(10),
      ]);

      const criticalTriggers = triggers?.filter((t: any) => t.urgency === 'critical') || [];

      const briefingText = await callClaude(
        `You are the Dynasty OS CEO Briefing Agent for David Sutherland. Provide a sharp, actionable morning briefing covering ${BRANDS.join(', ')}. Be direct. No fluff.

Brand context:
${Object.entries(BRAND_CONTEXT).map(([b, c]) => `${b}: ${c}`).join('\n')}

Return JSON:
{"briefing_sms":"under 160 chars","top_priorities":[{"priority":1,"action":"...","brand":"...","urgency":"..."}],"critical_alerts":["alert1"],"opportunities":["opp1"],"one_sentence_summary":"..."}`,
        `New leads today: ${leads?.length || 0}\nClosed deals today: ${accounts?.length || 0}\nPending visit triggers: ${triggers?.length || 0}\nCritical triggers: ${criticalTriggers.length}\nCritical stores: ${criticalTriggers.map((t: any) => t.store_name).join(', ') || 'none'}\nUnresolved AI insights: ${insights?.length || 0}`,
        'claude-sonnet-4-20250514', 1000
      );

      const briefing = parseJSON(briefingText);
      await saveInsight(agentName, 'All Brands', 'recommendation',
        `Morning Briefing — ${new Date().toLocaleDateString()}`,
        briefing.one_sentence_summary || 'Daily briefing generated',
        briefing.critical_alerts?.length ? 'critical' : 'normal', true
      );

      // Send SMS to David
      const davidPhone = Deno.env.get('OWNER_PHONE_NUMBER');
      if (davidPhone && briefing.briefing_sms) {
        await supabase.functions.invoke('send-sms', {
          body: {
            to_number: davidPhone,
            message_body: `🏆 Dynasty OS Briefing:\n${briefing.briefing_sms}`,
            idempotency_key: `briefing-${Date.now()}`,
          },
        }).catch(() => null);
      }

      summary = briefing.one_sentence_summary || 'CEO briefing completed';
      insightsCount = 1;
    }

    // ═══════════════════════════════
    // ACCOUNT HEALTH AGENT
    // ═══════════════════════════════
    else if (agentName === 'Account Health Agent') {
      const { data: stores } = await supabase
        .from('brandaro_qualified_leads').select('*')
        .not('pipeline_stage', 'in', '(closed,lost)')
        .order('updated_at', { ascending: true }).limit(100);

      const atRisk: any[] = [];
      for (const store of stores || []) {
        const daysSinceUpdate = Math.floor((Date.now() - new Date(store.updated_at || store.created_at).getTime()) / 86400000);
        const healthScore = Math.max(0, 100 - (daysSinceUpdate * 3) - (store.call_attempts > 3 ? 20 : 0));
        if (healthScore < 40) {
          atRisk.push({ ...store, health_score: healthScore, days_inactive: daysSinceUpdate });
        }
      }

      if (atRisk.length > 0) {
        const advice = await callClaude(
          `You are the Account Health Agent for Dynasty OS distribution brands. Analyze at-risk accounts and recommend interventions. Return JSON array: [{"store_name":"...","risk_level":"critical|high|medium","reason":"...","recommended_action":"...","fire_visit_trigger":true}]`,
          `At-risk accounts:\n${atRisk.slice(0, 20).map((s: any) => `${s.business_name} | ${s.city} | Stage: ${s.pipeline_stage} | Inactive: ${s.days_inactive} days | Score: ${s.health_score}`).join('\n')}`
        );
        const recommendations = parseJSON(advice);
        for (const rec of (Array.isArray(recommendations) ? recommendations : [])) {
          await saveInsight(agentName, 'GasMask', rec.risk_level === 'critical' ? 'alert' : 'risk',
            `Account at risk: ${rec.store_name}`, `${rec.reason}. Recommended: ${rec.recommended_action}`,
            rec.risk_level === 'critical' ? 'critical' : 'high', true, rec.store_name);
          if (rec.fire_visit_trigger) {
            const storeData = atRisk.find((s: any) => s.business_name === rec.store_name);
            await fireVisitTrigger({
              store_name: rec.store_name, store_city: storeData?.city,
              trigger_source: 'Account Health Agent', trigger_type: 'follow_up',
              floor_source: 'floor1_crm', urgency: rec.risk_level === 'critical' ? 'critical' : 'high',
              priority_score: rec.risk_level === 'critical' ? 10 : 7, trigger_notes: rec.reason,
            });
            triggersCount++;
          }
          insightsCount++;
          actionsCount++;
        }
      }
      summary = `Analyzed ${stores?.length || 0} accounts. ${atRisk.length} at risk. ${triggersCount} visit triggers fired.`;
    }

    // ═══════════════════════════════
    // FOLLOW-UP CADENCE AGENT
    // ═══════════════════════════════
    else if (agentName === 'Follow-Up Cadence Agent') {
      const cutoff = new Date(Date.now() - 72 * 3600000).toISOString();
      const { data: coldLeads } = await supabase
        .from('brandaro_qualified_leads').select('*')
        .in('pipeline_stage', ['new', 'contacted', 'responded'])
        .lt('updated_at', cutoff).eq('ai_paused', false)
        .not('phone_number', 'is', null)
        .order('priority_score', { ascending: false }).limit(30);

      for (const lead of coldLeads || []) {
        const daysCold = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000);
        await supabase.functions.invoke('sms-writer', {
          body: {
            lead_id: lead.id, business_name: lead.business_name,
            city: lead.city, industry: lead.industry, call_attempts: lead.call_attempts,
            context: `Account has been cold for ${daysCold} days. Write a re-engagement follow-up message.`,
          },
        }).catch(() => null);
        actionsCount++;

        if (daysCold > 7) {
          await fireVisitTrigger({
            store_name: lead.business_name, store_city: lead.city,
            trigger_source: 'Follow-Up Cadence Agent', trigger_type: 'follow_up',
            floor_source: 'floor1_crm', urgency: daysCold > 14 ? 'high' : 'normal',
            priority_score: 6, trigger_notes: `Cold ${daysCold} days. Stage: ${lead.pipeline_stage}`,
          });
          triggersCount++;
        }
      }
      summary = `Processed ${coldLeads?.length || 0} cold leads. ${actionsCount} follow-ups queued. ${triggersCount} visit triggers fired.`;
    }

    // ═══════════════════════════════
    // COLLECTIONS AGENT
    // ═══════════════════════════════
    else if (agentName === 'Collections Agent') {
      // OUTREACH GATE (2026-08-23): this agent sends SMS to customers directly.
      if (!(await outreachAllowed('dynasty_collections_agent'))) {
        summary = 'Collections Agent gated — outreach switch off';
        await supabase.from('dynasty_agent_runs').insert({ agent_name: agentName, status: 'gated', summary, completed_at: new Date().toISOString() }).catch(() => null);
        return new Response(JSON.stringify({ ok: true, gated: true, switch: 'dynasty_collections_agent' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: stuckLeads } = await supabase
        .from('brandaro_qualified_leads').select('*')
        .eq('pipeline_stage', 'booked')
        .lt('updated_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(20);

      for (const lead of stuckLeads || []) {
        if (!lead.phone_number) continue;
        await supabase.functions.invoke('send-sms', {
          body: {
            to_number: lead.phone_number,
            message_body: `Hi ${lead.business_name}, this is a friendly reminder about your pending account. Please call us at your earliest convenience.`,
            idempotency_key: `collection-${lead.id}-${Date.now()}`,
          },
        }).catch(() => null);
        actionsCount++;

        if (lead.call_attempts >= 3) {
          await fireVisitTrigger({
            store_name: lead.business_name, store_city: lead.city,
            trigger_source: 'Collections Agent', trigger_type: 'collection',
            floor_source: 'floor1_crm', urgency: 'high', priority_score: 8,
            trigger_notes: `Overdue account. ${lead.call_attempts} attempts made.`,
          });
          triggersCount++;
        }
      }
      summary = `Collections: ${actionsCount} reminders sent. ${triggersCount} visit triggers for in-person collection.`;
    }

    // ═══════════════════════════════
    // REVENUE INTELLIGENCE AGENT
    // ═══════════════════════════════
    else if (agentName === 'Revenue Intelligence Agent') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: closedLeads }, { data: pipeline }, { data: pendingTriggers }] = await Promise.all([
        supabase.from('brandaro_qualified_leads').select('business_name, city, industry').eq('pipeline_stage', 'closed').gte('created_at', thirtyDaysAgo),
        supabase.from('brandaro_qualified_leads').select('pipeline_stage').not('pipeline_stage', 'in', '(new,lost)'),
        supabase.from('gasmask_visit_triggers').select('trigger_type, urgency').eq('status', 'pending'),
      ]);

      const revenueAnalysis = await callClaude(
        `You are the Revenue Intelligence Agent for Dynasty OS covering ${BRANDS.join(', ')}. Return JSON: {"revenue_trend":"growing|stable|declining","top_opportunity":"...","biggest_risk":"...","recommended_focus":"...","brand_recommendations":{"GasMask":"...","Hot Mama Grabba":"...","Grabba R Us":"...","Hot Scalatti":"..."},"30_day_forecast":"optimistic|neutral|concerning"}`,
        `Closed deals: ${closedLeads?.length || 0}\nActive pipeline: ${pipeline?.length || 0}\nPending visits: ${pendingTriggers?.length || 0}\nPipeline: ${JSON.stringify(pipeline?.reduce((acc: any, l: any) => { acc[l.pipeline_stage] = (acc[l.pipeline_stage] || 0) + 1; return acc; }, {}))}`,
        'claude-sonnet-4-20250514', 1500
      );
      const analysis = parseJSON(revenueAnalysis);
      await saveInsight(agentName, 'All Brands', 'trend',
        `Revenue Intelligence — ${new Date().toLocaleDateString()}`,
        `Trend: ${analysis.revenue_trend}. Top opportunity: ${analysis.top_opportunity}. Biggest risk: ${analysis.biggest_risk}`,
        analysis.revenue_trend === 'declining' ? 'high' : 'normal', analysis.revenue_trend === 'declining');

      for (const [brand, rec] of Object.entries(analysis.brand_recommendations || {})) {
        await saveInsight(agentName, brand, 'recommendation', `${brand} — Action Required`, rec as string, 'normal', false);
      }
      insightsCount = 1 + Object.keys(analysis.brand_recommendations || {}).length;
      summary = `Revenue trend: ${analysis.revenue_trend}. ${insightsCount} insights saved.`;
    }

    // ═══════════════════════════════
    // ONBOARDING AGENT
    // ═══════════════════════════════
    else if (agentName === 'Onboarding Agent') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: newLeads } = await supabase
        .from('brandaro_qualified_leads').select('*')
        .eq('pipeline_stage', 'new').gte('created_at', sevenDaysAgo)
        .not('phone_number', 'is', null).eq('call_attempts', 0).limit(20);

      for (const lead of newLeads || []) {
        await supabase.functions.invoke('sms-writer', {
          body: {
            lead_id: lead.id, business_name: lead.business_name,
            city: lead.city, industry: lead.industry, call_attempts: 0,
            context: 'This is a NEW lead. Write a warm first-touch outreach SMS introducing Brandaro Digital website services. Be friendly, not salesy.',
          },
        }).catch(() => null);
        actionsCount++;
      }
      summary = `Onboarding: ${newLeads?.length || 0} new leads processed. ${actionsCount} welcome SMS queued.`;
    }

    // ═══════════════════════════════
    // GENERIC HANDLER (Inventory, Territory, Complaint, etc.)
    // ═══════════════════════════════
    else {
      summary = `Agent "${agentName}" recognized but has no specialized handler yet. Registered for future implementation.`;
    }

    // Update run log
    await supabase.from('dynasty_agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      actions_taken: actionsCount, insights_generated: insightsCount,
      triggers_fired: triggersCount, summary,
    }).eq('id', runId);

    // Update agent last_run
    await supabase.from('dynasty_agents').update({
      last_run_at: new Date().toISOString(),
    }).eq('agent_name', agentName);

    return new Response(JSON.stringify({
      success: true, agent: agentName, run_id: runId,
      actions_taken: actionsCount, insights_generated: insightsCount,
      triggers_fired: triggersCount, summary,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('[AGENT-RUNNER]', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
