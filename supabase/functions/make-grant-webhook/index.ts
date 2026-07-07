import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let action: string | undefined;
  let payload: any = {};
  let result: any = {};
  let status: 'success' | 'error' = 'success';
  let httpBody: any = {};

  try {
    const secret = Deno.env.get('MAKE_WEBHOOK_SECRET');
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    payload = body;

    const providedSecret =
      req.headers.get('x-make-secret') ||
      req.headers.get('x-webhook-secret') ||
      body?.secret;

    if (secret && providedSecret !== secret) {
      status = 'error';
      result = { error: 'Invalid or missing webhook secret' };
      httpBody = result;
    } else {
      action = body?.action;

      if (action === 'submit') {
        const { application_id } = body;
        if (!application_id) {
          status = 'error';
          result = { error: 'application_id required' };
          httpBody = result;
        } else {
          const { data, error } = await supabase.functions.invoke(
            'submit-grant-application',
            { body: { application_id, submission_method: body.submission_method ?? 'email' } },
          );
          if (error) {
            status = 'error';
            result = { error: error.message, data };
          } else {
            result = { ok: true, data };
          }
          httpBody = result;
        }
      } else if (action === 'draft_ready') {
        const { application_id } = body;
        if (!application_id) {
          status = 'error';
          result = { error: 'application_id required' };
          httpBody = result;
        } else {
          const { data: app } = await supabase
            .from('grant_applications')
            .select('id, grant_name, funder_name, ai_draft, deadline, funding_client_id')
            .eq('id', application_id)
            .maybeSingle();

          const resendKey = Deno.env.get('RESEND_API_KEY');
          if (resendKey && app) {
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${resendKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'grants@dynastyconnect.com',
                  to: 'david@dynastyconnect.com',
                  subject: `Draft Ready — ${app.grant_name ?? 'Grant'} (${app.funder_name ?? ''})`,
                  text: `A draft is ready for review.\n\nGrant: ${app.grant_name}\nFunder: ${app.funder_name}\nDeadline: ${app.deadline ?? 'N/A'}\nApplication ID: ${app.id}`,
                }),
              });
            } catch (e) {
              console.error('Resend send failed', e);
            }
          }
          result = { ok: true, notified: !!resendKey, application: app };
          httpBody = result;
        }
      } else {
        status = 'error';
        result = {
          error: `Unknown action: ${action}`,
          valid_actions: ['submit', 'draft_ready'],
        };
        httpBody = result;
      }
    }
  } catch (err) {
    status = 'error';
    result = { error: (err as Error).message };
    httpBody = result;
  }

  try {
    await supabase.from('make_automation_log').insert({
      scenario_name: 'make-grant-webhook',
      trigger_type: action ?? 'unknown',
      payload,
      result,
      status,
    });
  } catch (e) {
    console.error('log insert failed', e);
  }

  return new Response(JSON.stringify(httpBody), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
