// generate-grant-draft
// POST { application_id } → generates 5-section grant draft (<=600 words),
// stores in grant_applications.ai_draft, returns { draft, word_count,
// application_id, generation_time_ms }.
// Falls back gracefully when ANTHROPIC_API_KEY is missing (deterministic
// template) so the function never returns 5xx for missing config.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function wordCount(s: string): number {
  return (s.trim().match(/\S+/g) ?? []).length;
}

function buildFallbackDraft(app: any, applicant: string): string {
  const amt = app.amount_requested ? `$${Number(app.amount_requested).toLocaleString()}` : 'the requested amount';
  const grant = app.grant_name ?? 'this grant';
  const funder = app.funder_name ?? 'the funding organization';
  return [
    `# Executive Summary`,
    `${applicant} respectfully submits this application for ${grant} offered by ${funder}, requesting ${amt}. Funds will strengthen operations, expand community impact, and advance measurable outcomes aligned with the funder's stated mission.`,
    ``,
    `# Organization Description`,
    `${applicant} is an established organization committed to community impact, operational excellence, and measurable results. Leadership brings sector experience, financial discipline, and a proven track record of stewardship, positioning the organization to deploy grant capital responsibly.`,
    ``,
    `# Project Description`,
    `The proposed project directly advances the priorities of ${funder} by delivering targeted programming, capacity building, and community services. Activities are scoped, resourced, and scheduled to produce clear deliverables within the grant period, with defined milestones and accountable owners.`,
    ``,
    `# Goals and Measurable Outcomes`,
    `Primary goals include expanded service delivery, improved beneficiary outcomes, and durable capacity gains. Outcomes will be tracked through KPIs, program dashboards, and quarterly reports shared with ${funder} to demonstrate transparent, evidence-based progress.`,
    ``,
    `# Budget Justification`,
    `The ${amt} budget covers personnel, program delivery, and reasonable administrative costs directly tied to the funded activities. Every line item ties to a milestone or deliverable; matched and in-kind resources reduce net cost per outcome and maximize funder ROI.`,
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
  const started = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const application_id = body?.application_id;
    if (!isUuid(application_id)) {
      return new Response(JSON.stringify({ error: 'application_id (uuid) required' }), {
        status: 400, headers: jsonHeaders,
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: app, error: loadErr } = await supabase
      .from('grant_applications')
      .select('*, funding_clients:funding_client_id(full_name, credit_score_estimate)')
      .eq('id', application_id)
      .maybeSingle();

    if (loadErr || !app) {
      return new Response(JSON.stringify({ error: loadErr?.message || 'Application not found' }), {
        status: 404, headers: jsonHeaders,
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let draft = '';
    let ai_source: 'lovable_ai' | 'fallback' = 'fallback';
    let ai_error: string | null = null;

    if (LOVABLE_API_KEY) {
      const prompt = `You are an expert grant writer. Write a complete grant application for:

Grant: ${app.grant_name}
Funder: ${app.funder_name}
Applicant: ${applicant}
Amount Requested: $${app.amount_requested?.toLocaleString() ?? 'varies'}
${creditScore ? 'Credit Score: ' + creditScore : ''}

Write EXACTLY these 5 sections using markdown H1 headers (# Section Name), in this order and no others:
1. Executive Summary (~100 words)
2. Organization Description (~100 words)
3. Project Description (~150 words)
4. Goals and Measurable Outcomes (~100 words)
5. Budget Justification (~100 words)

Total UNDER 600 words. Professional, compelling, specific. Reference the business name, grant name, funder, and requested amount.`;

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25_000);
        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'Lovable-API-Key': LOVABLE_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'You are an expert grant writer producing polished, funder-ready narratives.' },
              { role: 'user', content: prompt },
            ],
          }),
        }).finally(() => clearTimeout(timer));

        if (aiRes.ok) {
          const data = await aiRes.json();
          const text = data?.choices?.[0]?.message?.content ?? '';
          if (text.trim()) {
            draft = text;
            ai_source = 'lovable_ai';
          } else {
            ai_error = 'empty_ai_response';
          }
        } else {
          const bodyText = (await aiRes.text()).slice(0, 300);
          ai_error = `lovable_ai_${aiRes.status}`;
          console.error('[generate-grant-draft] lovable ai error', aiRes.status, bodyText);
        }
      } catch (e: any) {
        ai_error = e?.name === 'AbortError' ? 'lovable_ai_timeout' : 'lovable_ai_failure';
        console.error('[generate-grant-draft] lovable ai exception', e?.message ?? e);
      }
    } else {
      ai_error = 'missing_api_key';
    }

    if (!draft) {
      draft = buildFallbackDraft(app, applicant);
    }

    // Enforce max 600 words softly by trimming trailing words if over
    const wc = wordCount(draft);
    if (wc > 600) {
      const words = draft.split(/(\s+)/);
      let count = 0;
      const kept: string[] = [];
      for (const tok of words) {
        if (/\S/.test(tok)) {
          if (count >= 600) break;
          count++;
        }
        kept.push(tok);
      }
      draft = kept.join('').trimEnd();
    }

    const finalWordCount = wordCount(draft);

    const { error: updateErr } = await supabase
      .from('grant_applications')
      .update({ ai_draft: draft, updated_at: new Date().toISOString() })
      .eq('id', application_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500, headers: jsonHeaders,
      });
    }

    const generation_time_ms = Date.now() - started;
    console.log('[generate-grant-draft] ok', {
      application_id, ai_source, ai_error, word_count: finalWordCount, generation_time_ms,
    });

    return new Response(JSON.stringify({
      ok: true,
      application_id,
      draft,
      word_count: finalWordCount,
      generation_time: generation_time_ms,
      generation_time_ms,
      ai_source,
      ai_error,
    }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error('generate-grant-draft error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
