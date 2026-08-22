/**
 * store-account-briefing — generates (or regenerates) the cached account
 * manager briefing for one store.
 *
 * Auth: requires a signed-in user JWT. The Anthropic call and the
 * store_ai_briefing upsert both happen server-side so the API key and the
 * write path never reach the browser.
 *
 * POST { store_id }
 * Returns { briefing, analyzed_at, refresh_count }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are an account manager briefing a field rep who is about to visit or call this store. Write in plain English, no jargon, no bullet-point padding. Cover: what kind of account this is and how it has behaved; what has changed recently; anything owed and how old it is; what they stock and what they have never been offered; who to speak to and anything known about how they respond; and what specifically needs doing on this visit. If the notes contain contradictions or something that looks wrong, say so. Keep it under 250 words. Do not invent anything not present in the data.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: identify the caller for analyzed_by ────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not signed in' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const { store_id } = await req.json();
    if (!store_id) {
      return new Response(JSON.stringify({ error: 'store_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Pull the assembled input from the view ───────────────────────────
    const { data: input, error: inputError } = await supabase
      .from('v_store_briefing_input')
      .select('*')
      .eq('store_id', store_id)
      .maybeSingle();

    if (inputError) throw inputError;
    if (!input) {
      return new Response(JSON.stringify({ error: 'Store not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = [
      `STORE FACTS:\n${input.facts ?? '(none)'}`,
      `\nRECENT NOTES (real dates, newest first):\n${input.recent_notes ?? '(none)'}`,
      `\nRECENT INVOICES (newest first):\n${input.recent_invoices ?? '(none)'}`,
    ].join('\n');

    // ── Anthropic call ───────────────────────────────────────────────────
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('Anthropic error', aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `AI request failed (${aiResponse.status})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiJson = await aiResponse.json();
    const briefing: string = (aiJson.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();

    if (!briefing) throw new Error('Empty briefing returned');

    // ── Upsert the cache row ─────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('store_ai_briefing')
      .select('refresh_count')
      .eq('store_id', store_id)
      .maybeSingle();

    const analyzedAt = new Date().toISOString();
    const refreshCount = (existing?.refresh_count ?? 0) + 1;

    const { error: upsertError } = await supabase
      .from('store_ai_briefing')
      .upsert(
        {
          store_id,
          briefing,
          analyzed_at: analyzedAt,
          analyzed_by: userId,
          model: MODEL,
          is_stale: false,
          refresh_count: refreshCount,
        },
        { onConflict: 'store_id' },
      );

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ briefing, analyzed_at: analyzedAt, refresh_count: refreshCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('store-account-briefing error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
