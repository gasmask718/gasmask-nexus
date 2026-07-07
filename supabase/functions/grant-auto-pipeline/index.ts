import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const FUNDER_APIS: Record<string, true> = {
  'hello alice': true,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const summary = {
    processed: 0,
    submitted_count: 0,
    manual_queued: 0,
    errors: [] as { application_id: string; error: string }[],
    submissions: [] as {
      application_id: string;
      method: string;
      status?: string;
      grant_name?: string;
      client?: string;
    }[],
  };

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const today = new Date();

    // Load ALL drafting + un-submitted apps; filter deadline_type in JS
    // because deadline_type lives on grant_opportunities, not grant_applications.
    const { data: apps, error: qErr } = await supabase
      .from('grant_applications')
      .select(`
        id, funding_client_id, ai_draft,
        submitted_at, status, deadline,
        grant_name, funder_name,
        opportunity_id,
        grant_opportunities:opportunity_id(
          funder_name, contact_email,
          application_url, grant_name, deadline_type
        ),
        funding_clients:funding_client_id(
          full_name, first_name, last_name,
          business_name
        )
      `)
      .eq('status', 'drafting')
      .not('ai_draft', 'is', null)
      .is('submitted_at', null);

    if (qErr) {
      return json({ success: false, error: `Query failed: ${qErr.message}`, summary });
    }

    // JS-side eligibility filter (deadline within 14d OR rolling)
    const eligible = (apps ?? []).filter((app: any) => {
      const opp = app.grant_opportunities ?? {};
      const isRolling = opp.deadline_type === 'rolling';
      const deadline = app.deadline;
      if (!deadline && !isRolling) return false;
      if (isRolling) return true;
      const daysUntil = Math.floor(
        (new Date(deadline).getTime() - today.getTime()) / 86400000
      );
      return daysUntil >= 0 && daysUntil <= 14;
    });

    for (const app of eligible) {
      summary.processed++;
      const opp = (app as any).grant_opportunities ?? {};
      const client = (app as any).funding_clients ?? {};
      const funderKey = String(opp.funder_name ?? (app as any).funder_name ?? '')
        .toLowerCase()
        .trim();

      let method: 'email' | 'api' | 'manual' = 'manual';
      if (FUNDER_APIS[funderKey]) method = 'api';
      else if (opp.contact_email) method = 'email';

      try {
        const { data: res, error: invErr } = await supabase.functions.invoke(
          'submit-grant-application',
          { body: { application_id: (app as any).id, submission_method: method } }
        );
        if (invErr) throw new Error(invErr.message);

        const clientName =
          client.business_name ||
          client.full_name ||
          [client.first_name, client.last_name].filter(Boolean).join(' ') ||
          '—';

        summary.submissions.push({
          application_id: (app as any).id,
          method,
          status: res?.status,
          grant_name: opp.grant_name ?? (app as any).grant_name,
          client: clientName,
        });

        if (res?.status === 'submitted') {
          summary.submitted_count++;
        } else if (res?.status === 'queued') {
          summary.manual_queued++;
        } else if (res?.error) {
          summary.errors.push({ application_id: (app as any).id, error: res.error });
        }
      } catch (err) {
        summary.errors.push({
          application_id: (app as any).id,
          error: (err as Error).message,
        });
      }
    }

    // ─── David summary email ────────────────────────────────────────────
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && (summary.processed > 0 || summary.errors.length > 0)) {
      const rows = summary.submissions
        .map(
          (s) => `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.client ?? '—'}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.grant_name ?? '—'}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.method}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.status ?? '—'}</td>
          </tr>`
        )
        .join('');

      const errRows = summary.errors
        .map((e) => `<li><code>${e.application_id}</code> — ${e.error}</li>`)
        .join('');

      const subject = `Grant Auto-Pipeline — ${summary.submitted_count} submitted, ${summary.manual_queued} manual queue`;
      const html = `
        <div style="font-family:Arial,sans-serif;color:#111;max-width:820px;">
          <div style="border-top:4px solid #C9A84C;padding-top:16px;">
            <h2 style="margin:0 0 8px;">Grant Auto-Pipeline Run</h2>
            <p style="color:#555;margin:0 0 16px;">
              Processed <b>${summary.processed}</b> ·
              Submitted <b>${summary.submitted_count}</b> ·
              Manual queue <b>${summary.manual_queued}</b> ·
              Errors <b>${summary.errors.length}</b>
            </p>
            ${
              rows
                ? `<table style="border-collapse:collapse;width:100%;font-size:14px;">
                    <thead><tr style="background:#faf5e6;">
                      <th style="text-align:left;padding:6px 10px;">Client</th>
                      <th style="text-align:left;padding:6px 10px;">Grant</th>
                      <th style="text-align:left;padding:6px 10px;">Method</th>
                      <th style="text-align:left;padding:6px 10px;">Status</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                  </table>`
                : '<p><i>No applications processed.</i></p>'
            }
            ${errRows ? `<h3 style="margin-top:20px;color:#a33;">Errors</h3><ul>${errRows}</ul>` : ''}
          </div>
        </div>`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Dynasty Grants <grants@dynastyconnect.com>',
          to: ['david@dynastyconnect.com'],
          subject,
          html,
        }),
      });
      if (!emailRes.ok) {
        summary.errors.push({
          application_id: 'summary_email',
          error: `Resend ${emailRes.status}`,
        });
      }
    }

    return json({ success: true, summary });
  } catch (err) {
    console.error('grant-auto-pipeline error:', err);
    summary.errors.push({ application_id: 'pipeline', error: (err as Error).message });
    return json({ success: false, summary });
  }
});
