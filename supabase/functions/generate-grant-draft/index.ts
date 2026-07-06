import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(JSON.stringify({ error: 'application_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: app, error: loadErr } = await supabase
      .from('grant_applications')
      .select('*, funding_clients:funding_client_id(full_name, credit_score_estimate)')
      .eq('id', application_id)
      .maybeSingle();

    if (loadErr || !app) {
      return new Response(JSON.stringify({ error: loadErr?.message || 'Application not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientName = (app.funding_clients as any)?.full_name ?? null;
    const creditScore = (app.funding_clients as any)?.credit_score_estimate ?? null;

    const applicant =
      app.applicant_type === 'funding_client' && clientName
        ? clientName
        : app.applicant_type === 'uben'
        ? 'UBEN Network (501c3 nonprofit)'
        : 'Dynasty Connect LLC';

    const prompt = `You are an expert grant writer. Write a complete grant application for:

Grant: ${app.grant_name}
Funder: ${app.funder_name}
Applicant: ${applicant}
Amount Requested: $${app.amount_requested?.toLocaleString() ?? 'varies'}
${creditScore ? 'Credit Score: ' + creditScore : ''}

Write these 5 sections:
1. Executive Summary (100 words)
2. Organization Description (100 words)
3. Project Description (150 words)
4. Goals and Measurable Outcomes (100 words)
5. Budget Justification (100 words)

Total under 600 words.
Professional tone.
Compelling and specific.
Focus on impact and outcomes.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text();
      console.error(`Anthropic error [${anthropicRes.status}]:`, body);
      return new Response(JSON.stringify({ error: 'Anthropic API failed', status: anthropicRes.status, details: body }), {
        status: anthropicRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await anthropicRes.json();
    const draft = data?.content?.[0]?.text ?? '';
    if (!draft) {
      return new Response(JSON.stringify({ error: 'Empty response from Anthropic', raw: data }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateErr } = await supabase
      .from('grant_applications')
      .update({ ai_draft: draft, updated_at: new Date().toISOString() })
      .eq('id', application_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, draft }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-grant-draft error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
