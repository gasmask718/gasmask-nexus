// Initiates an outbound Bland.ai call for an ambassador to a store.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BLAND_API_KEY = Deno.env.get('BLAND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const DEFAULT_EN_PERSONA = '358e79c7-fc23-4494-8c89-21d489253bef';
// TODO: Provision Arabic voice in Bland.ai dashboard and update this constant.
const AR_PERSONA = DEFAULT_EN_PERSONA; // fallback to EN until Arabic persona is provisioned

const isQuietHours = () => {
  const h = new Date().getUTCHours() - 5;
  const local = (h + 24) % 24;
  return local < 9 || local >= 19;
};

function hydrate(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims?.sub) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const userId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { store_id, script_template_id, objective, custom_variables = {} } = await req.json();
    if (!store_id || !script_template_id) return new Response(JSON.stringify({ error: 'store_id and script_template_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: amb } = await admin.from('ambassadors').select('id, name, twilio_number, is_active, ai_call_hourly_limit, ai_call_daily_limit').eq('user_id', userId).maybeSingle();
    if (!amb?.is_active) return new Response(JSON.stringify({ error: 'Ambassador not active' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: store } = await admin.from('store_master').select('id, store_name, phone, owner_name, owner_name_arabic, assigned_ambassador_id, language_preference, last_order_date, status').eq('id', store_id).maybeSingle();
    if (!store) return new Response(JSON.stringify({ error: 'Store not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (store.assigned_ambassador_id !== amb.id) return new Response(JSON.stringify({ error: 'Store not assigned to you' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!store.phone) return new Response(JSON.stringify({ error: 'Store missing phone' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (store.status === 'blacklisted') return new Response(JSON.stringify({ error: 'Store is blacklisted' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (isQuietHours()) return new Response(JSON.stringify({ error: 'Quiet hours — AI calls allowed 9am–7pm ET' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Cooldown: same store, last 4 hours
    const cooldown = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { count: recentToStore } = await admin.from('communication_logs').select('*', { count: 'exact', head: true }).eq('store_id', store_id).eq('call_type', 'ai_assisted').gte('created_at', cooldown);
    if ((recentToStore ?? 0) > 0) return new Response(JSON.stringify({ error: 'Cooldown: same store cannot receive 2 AI calls within 4 hours' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Rate limits
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourCount } = await admin.from('communication_logs').select('*', { count: 'exact', head: true }).eq('ambassador_id', amb.id).eq('call_type', 'ai_assisted').gte('created_at', hourAgo);
    if ((hourCount ?? 0) >= (amb.ai_call_hourly_limit ?? 10)) return new Response(JSON.stringify({ error: 'Hourly AI call limit reached' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dayCount } = await admin.from('communication_logs').select('*', { count: 'exact', head: true }).eq('ambassador_id', amb.id).eq('call_type', 'ai_assisted').gte('created_at', dayAgo);
    if ((dayCount ?? 0) >= (amb.ai_call_daily_limit ?? 50)) return new Response(JSON.stringify({ error: 'Daily AI call limit reached' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: script } = await admin.from('ambassador_call_scripts').select('*').eq('id', script_template_id).maybeSingle();
    if (!script) return new Response(JSON.stringify({ error: 'Script not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Derived vars
    const daysSince = store.last_order_date ? Math.floor((Date.now() - new Date(store.last_order_date).getTime()) / 86400000) : 0;
    const vars = {
      store_name: store.store_name || '',
      owner_name: (script.language === 'ar' && store.owner_name_arabic) ? store.owner_name_arabic : (store.owner_name || 'there'),
      ambassador_name: amb.name || 'your rep',
      outstanding_balance: '$0',
      last_order_date: store.last_order_date ? new Date(store.last_order_date).toLocaleDateString() : 'a while ago',
      days_since_last_order: String(daysSince),
      top_product: 'your usual',
      new_product: 'our newest item',
      discount: '15%',
      phone: store.phone,
      ...custom_variables,
    };

    const persona = (store.language_preference === 'ar' && script.language === 'ar') ? AR_PERSONA : (script.voice_persona_id || DEFAULT_EN_PERSONA);
    const task = hydrate(script.script_body, vars);
    const firstSentence = hydrate(script.opening_line || '', vars);

    // Pre-create log
    const { data: log } = await admin.from('communication_logs').insert({
      ambassador_id: amb.id, store_id, channel: 'voice', direction: 'outbound',
      call_type: 'ai_assisted', status: 'dialing', started_at: new Date().toISOString(),
      script_template_id, call_objective: objective || script.objective,
      voice_persona_used: persona, transcript_status: 'pending',
      recipient_phone: store.phone, sender_phone: amb.twilio_number,
      ai_assisted: true,
    }).select('id').single();

    const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
    const webhook = `https://${projectRef}.functions.supabase.co/bland-call-webhook`;

    const blandRes = await fetch('https://api.bland.ai/v1/calls', {
      method: 'POST',
      headers: { 'Authorization': BLAND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: store.phone,
        from: amb.twilio_number || undefined,
        task, first_sentence: firstSentence || undefined,
        voice: persona,
        language: script.language === 'ar' ? 'ara' : 'eng',
        max_duration: script.max_duration_seconds || 240,
        record: true,
        webhook,
        metadata: { log_id: log!.id, ambassador_id: amb.id, store_id, script_template_id, objective: objective || script.objective },
        answered_by_enabled: true,
        wait_for_greeting: true,
      }),
    });
    const blandData = await blandRes.json();
    if (!blandRes.ok || blandData.status === 'error') {
      await admin.from('communication_logs').update({ status: 'failed', notes: `Bland: ${blandData.message || JSON.stringify(blandData)}` }).eq('id', log!.id);
      return new Response(JSON.stringify({ error: blandData.message || 'Bland.ai error', detail: blandData }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await admin.from('communication_logs').update({ bland_call_id: blandData.call_id }).eq('id', log!.id);
    await admin.from('ambassador_call_scripts').update({ usage_count: (script.usage_count || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', script_template_id);
    await admin.from('ambassador_activity_log').insert({ ambassador_id: amb.id, store_id, action_type: 'ai_call_initiated', metadata: { bland_call_id: blandData.call_id, script_name: script.name, objective: objective || script.objective } });

    return new Response(JSON.stringify({ success: true, log_id: log!.id, bland_call_id: blandData.call_id, estimated_duration: script.max_duration_seconds }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('ai-call error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
