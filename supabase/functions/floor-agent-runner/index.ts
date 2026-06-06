import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Read-only data slices per floor — strictly scoped
async function gatherFloorData(supabase: any, floor: number): Promise<string> {
  switch (floor) {
    case 1: {
      const { data: stores } = await supabase
        .from('store_master')
        .select('id, store_name, phone, address, updated_at, status')
        .ilike('status', '%active%')
        .or('phone.is.null,address.is.null')
        .limit(50);
      return `Active stores missing phone/address (${stores?.length || 0}):\n${JSON.stringify(stores || [], null, 2)}`;
    }
    case 2: {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data: silent } = await supabase
        .from('store_master')
        .select('id, store_name, last_contacted_at')
        .ilike('status', '%active%')
        .or(`last_contacted_at.is.null,last_contacted_at.lt.${since}`)
        .limit(40);
      return `Stores silent 30d+ (${silent?.length || 0}):\n${JSON.stringify(silent || [], null, 2)}`;
    }
    case 3: {
      const { data: low } = await supabase
        .from('inventory_stock')
        .select('product_id, qty_on_hand, reorder_point')
        .limit(60);
      return `Inventory snapshot:\n${JSON.stringify(low || [], null, 2)}`;
    }
    case 4: {
      const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: triggers } = await supabase
        .from('gasmask_visit_triggers')
        .select('id, store_id, trigger_type, created_at')
        .eq('status', 'pending')
        .lt('created_at', cutoff)
        .limit(50);
      return `Aging undelivered triggers >7d (${triggers?.length || 0}):\n${JSON.stringify(triggers || [], null, 2)}`;
    }
    case 5: {
      const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data: overdue } = await supabase
        .from('invoices')
        .select('id, store_id, total, status, created_at')
        .eq('status', 'finalized')
        .lt('created_at', cutoff)
        .limit(40);
      return `Invoices possibly overdue >14d (${overdue?.length || 0}):\n${JSON.stringify(overdue || [], null, 2)}`;
    }
    case 6: {
      const { data: batches } = await supabase
        .from('production_batches')
        .select('id, brand, tobacco_lbs, batch_date')
        .order('batch_date', { ascending: false })
        .limit(30);
      return `Recent batches:\n${JSON.stringify(batches || [], null, 2)}`;
    }
    case 7: {
      const since = new Date(Date.now() - 45 * 86400_000).toISOString();
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('id, wholesaler_id, total_amount, created_at')
        .gte('created_at', since)
        .limit(60);
      return `Recent wholesale orders (45d):\n${JSON.stringify(orders || [], null, 2)}`;
    }
    case 8: {
      const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data: amb } = await supabase
        .from('ambassadors')
        .select('id, full_name, last_active_at')
        .or(`last_active_at.is.null,last_active_at.lt.${cutoff}`)
        .limit(40);
      return `Inactive ambassadors >14d (${amb?.length || 0}):\n${JSON.stringify(amb || [], null, 2)}`;
    }
    default:
      return 'No data slice defined for this floor.';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  try {
    const body = await req.json().catch(() => ({}));
    const agentId: string | undefined = body.agent_id;
    const floorParam: number | undefined = body.floor;

    let agents: any[] = [];
    if (agentId) {
      const { data } = await supabase.from('floor_agents').select('*').eq('id', agentId).limit(1);
      agents = data || [];
    } else if (floorParam) {
      const { data } = await supabase.from('floor_agents').select('*').eq('floor', floorParam).eq('enabled', true);
      agents = data || [];
    } else {
      const { data } = await supabase.from('floor_agents').select('*').eq('enabled', true);
      agents = data || [];
    }

    const results: any[] = [];

    for (const agent of agents) {
      // Daily budget reset
      const today = new Date().toISOString().slice(0, 10);
      if (agent.budget_reset_at !== today) {
        await supabase.from('floor_agents').update({ tokens_used_today: 0, budget_reset_at: today }).eq('id', agent.id);
        agent.tokens_used_today = 0;
      }

      // Cost guardrail
      if (agent.tokens_used_today >= agent.daily_token_budget) {
        results.push({ agent: agent.agent_name, skipped: true, reason: 'daily_token_budget_exceeded' });
        continue;
      }

      const { data: run } = await supabase.from('floor_agent_runs').insert({
        agent_id: agent.id, floor: agent.floor, status: 'running',
      }).select('id').single();

      try {
        const dataSlice = await gatherFloorData(supabase, agent.floor);
        const systemPrompt = `${agent.charter}\n\nRespond ONLY with a JSON array of findings. Each finding: {"title": string, "severity": "low"|"medium"|"high", "entity_type": string, "entity_id": string|null, "recommendation": string, "details": string}. No prose.`;
        const userPrompt = `Floor ${agent.floor} read-only data slice:\n\n${dataSlice}\n\nReturn findings JSON now.`;

        let findings: any[] = [];
        let tokensUsed = 0;
        let summary = '';

        if (!anthropicKey) {
          summary = 'ANTHROPIC_API_KEY not configured — skipping LLM call';
        } else {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 1500,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
            }),
          });
          const json = await res.json();
          const text = json.content?.[0]?.text || '';
          tokensUsed = (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0);
          const m = text.match(/\[[\s\S]*\]/);
          try { findings = m ? JSON.parse(m[0]) : []; } catch { findings = []; }
          summary = `${findings.length} findings`;
        }

        // Write findings as recommendations into ai_action_queue (no auto-execute)
        for (const f of findings.slice(0, 25)) {
          await supabase.from('ai_action_queue').insert({
            action_type: `floor${agent.floor}_recommendation`,
            status: 'pending',
            priority: f.severity === 'high' ? 'high' : f.severity === 'medium' ? 'medium' : 'low',
            payload: {
              floor: agent.floor,
              agent: agent.agent_name,
              title: f.title,
              recommendation: f.recommendation,
              entity_type: f.entity_type,
              entity_id: f.entity_id,
              details: f.details,
            },
            source: 'floor_agent',
          }).then(() => {}, () => {});
        }

        await supabase.from('floor_agents').update({
          last_run_at: new Date().toISOString(),
          last_findings_count: findings.length,
          tokens_used_today: agent.tokens_used_today + tokensUsed,
          last_run_summary: { summary, tokens: tokensUsed, findings: findings.length },
        }).eq('id', agent.id);

        await supabase.from('floor_agent_runs').update({
          completed_at: new Date().toISOString(),
          status: 'completed',
          findings_count: findings.length,
          tokens_used: tokensUsed,
          summary,
          raw_output: findings,
        }).eq('id', run!.id);

        results.push({ agent: agent.agent_name, floor: agent.floor, findings: findings.length, tokens: tokensUsed });
      } catch (err: any) {
        await supabase.from('floor_agent_runs').update({
          completed_at: new Date().toISOString(), status: 'failed', error: String(err?.message || err),
        }).eq('id', run!.id);
        results.push({ agent: agent.agent_name, error: String(err?.message || err) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
