import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireGrantsStaff, grantsAuthResponse } from "../_shared/grantsAuth.ts";


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

// Registry of funders with API-based submission support.
// Extend as integrations are built.
const FUNDER_APIS: Record<string, { endpoint: string; envKey: string }> = {
  'hello alice': {
    endpoint: 'https://api.helloalice.com/v1/applications',
    envKey: 'HELLO_ALICE_API_KEY',
  },
};

interface SubmitPayload {
  application_id: string;
  submission_method: 'email' | 'api' | 'manual';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await requireGrantsStaff(req);
  if (!auth.ok) return grantsAuthResponse(auth, corsHeaders);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const payload = (await req.json()) as SubmitPayload;
    if (!payload?.application_id || !payload?.submission_method) {
      return json({ success: false, error: 'application_id and submission_method are required' });
    }

    // Load application + related opportunity + client
    const { data: app, error: appErr } = await supabase
      .from('grant_applications')
      .select('*, grant_opportunities(*), funding_clients(*)')
      .eq('id', payload.application_id)
      .maybeSingle();

    if (appErr || !app) {
      return json({ success: false, error: `Application not found: ${appErr?.message ?? 'no row'}` });
    }

    if (!app.ai_draft) {
      return json({ success: false, error: 'Application has no ai_draft to submit' });
    }
    if (app.submitted_at) {
      return json({ success: false, error: 'Application already submitted', submitted_at: app.submitted_at });
    }

    const opp = (app as any).grant_opportunities ?? {};
    const client = (app as any).funding_clients ?? {};
    const method = payload.submission_method;

    let submissionResult: { ok: boolean; detail: string; external_ref?: string | null } = {
      ok: false,
      detail: 'not attempted',
    };

    // ─── EMAIL ─────────────────────────────────────────────────────────────
    if (method === 'email') {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (!RESEND_API_KEY) {
        return json({ success: false, error: 'RESEND_API_KEY not configured' });
      }
      const to = opp.contact_email;
      if (!to) {
        return json({ success: false, error: 'grant_opportunity has no contact_email — cannot submit via email' });
      }

      const subject = `Grant Application — ${client.business_name ?? client.legal_name ?? 'Applicant'} — ${opp.grant_name ?? 'Grant'}`;
      const html = `
        <div style="font-family:Arial,sans-serif;color:#111;max-width:720px;">
          <div style="border-top:4px solid #C9A84C;padding-top:16px;">
            <h2 style="margin:0 0 12px;">${subject}</h2>
            <p style="color:#555;margin:0 0 16px;">Submitted via Dynasty Connect on behalf of ${client.business_name ?? client.legal_name ?? 'the applicant'}.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
            <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.5;">${String(app.ai_draft).replace(/</g, '&lt;')}</pre>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
            <p style="color:#888;font-size:12px;">Reply-to: grants@dynastyconnect.com</p>
          </div>
        </div>`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Dynasty Grants <grants@dynastyconnect.com>',
          to: [to],
          subject,
          html,
          reply_to: 'grants@dynastyconnect.com',
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        submissionResult = { ok: false, detail: `Resend error ${res.status}: ${JSON.stringify(body)}` };
      } else {
        submissionResult = { ok: true, detail: `Emailed to ${to}`, external_ref: body?.id ?? null };
      }
    }

    // ─── API ───────────────────────────────────────────────────────────────
    else if (method === 'api') {
      const funderKey = String(opp.funder_name ?? '').toLowerCase().trim();
      const cfg = FUNDER_APIS[funderKey];
      if (!cfg) {
        return json({ success: false, error: `No API integration for funder "${opp.funder_name}"` });
      }
      const apiKey = Deno.env.get(cfg.envKey);
      if (!apiKey) {
        return json({ success: false, error: `${cfg.envKey} not configured` });
      }

      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicant: {
            business_name: client.business_name,
            ein: client.ein,
            email: client.email,
            phone: client.phone,
          },
          grant_id: opp.external_id ?? opp.id,
          narrative: app.ai_draft,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        submissionResult = { ok: false, detail: `${funderKey} API ${res.status}: ${JSON.stringify(body)}` };
      } else {
        submissionResult = { ok: true, detail: `Submitted via ${funderKey} API`, external_ref: body?.id ?? null };
      }
    }

    // ─── MANUAL ────────────────────────────────────────────────────────────
    else if (method === 'manual') {
      const { error: taskErr } = await supabase.from('grant_tasks').insert({
        client_id: app.client_id,
        application_id: app.id,
        task_type: 'manual_submission',
        title: `Manually submit: ${opp.grant_name ?? 'Grant application'}`,
        description: `AI draft ready. Submit through funder portal: ${opp.application_url ?? 'N/A'}`,
        status: 'pending',
        priority: 'high',
      });
      if (taskErr) {
        submissionResult = { ok: false, detail: `Failed to queue task: ${taskErr.message}` };
      } else {
        submissionResult = { ok: true, detail: 'Manual submission task queued' };
      }
    } else {
      return json({ success: false, error: `Unknown submission_method: ${method}` });
    }

    // ─── UPDATE APPLICATION ────────────────────────────────────────────────
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      submission_method: method,
      last_submission_attempt_at: now,
      submission_notes: submissionResult.detail,
    };
    if (submissionResult.ok) {
      patch.status = method === 'manual' ? 'manual_queue' : 'submitted';
      patch.submitted_at = method === 'manual' ? null : now;
      if (submissionResult.external_ref) patch.external_reference = submissionResult.external_ref;
    } else {
      patch.status = 'submission_failed';
    }

    const { error: updErr } = await supabase
      .from('grant_applications')
      .update(patch)
      .eq('id', app.id);

    if (updErr) {
      return json({
        success: submissionResult.ok,
        warning: `submission ${submissionResult.ok ? 'succeeded' : 'failed'} but DB update failed: ${updErr.message}`,
        detail: submissionResult.detail,
      });
    }

    return json({
      success: submissionResult.ok,
      method,
      detail: submissionResult.detail,
      external_reference: submissionResult.external_ref ?? null,
      application_id: app.id,
    });
  } catch (err) {
    console.error('submit-grant-application error:', err);
    return json({ success: false, error: (err as Error).message });
  }
});
