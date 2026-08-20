// Bulk-asserts Twilio inbound webhooks for every ACTIVE number in v_phone_directory.
// Idempotent — safe to run on a cron. Pushes VoiceUrl + StatusCallback for each number
// and updates twilio_webhook_configured + twilio_webhook_configured_at in the source table.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';

async function sbFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!TWILIO_SID.startsWith('AC') || TWILIO_SID.length < 34) {
    return new Response(JSON.stringify({
      success: false,
      error: 'TWILIO_ACCOUNT_SID invalid — must start with AC and be ~34 chars.',
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (!TWILIO_TOKEN || TWILIO_TOKEN.length < 32) {
    return new Response(JSON.stringify({
      success: false,
      error: 'TWILIO_AUTH_TOKEN missing/invalid.',
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const authHeader = `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`;
  const voiceWebhook = `${SUPABASE_URL}/functions/v1/dc-inbound-call`;
  const statusWebhook = `${SUPABASE_URL}/functions/v1/dc-call-status`;

  // Pull every active number from the canonical view
  const dirResp = await sbFetch(`/rest/v1/v_phone_directory?is_active=eq.true&select=id,phone_e164,source_table,twilio_webhook_configured`);
  const allNumbers = await dirResp.json() as Array<{
    id: string; phone_e164: string; source_table: string; twilio_webhook_configured: boolean | null;
  }>;

  // Exclude numbers that belong to the Brandaro Twilio account (different creds).
  // Brandaro numbers now live in dc_phone_numbers (business='brandaro'). The legacy
  // dynasty_phone_numbers table was dropped in T7c-A Session 2.
  const brandaroResp = await sbFetch(
    `/rest/v1/dc_phone_numbers?business=eq.brandaro&select=id`
  );
  const brandaroRows = await brandaroResp.json() as Array<{ id: string }>;
  const brandaroIds = new Set(brandaroRows.map(r => r.id));
  const numbers = allNumbers.filter(
    n => !(n.source_table === 'dc_phone_numbers' && brandaroIds.has(n.id))
  );
  const excludedCount = allNumbers.length - numbers.length;


  const results: any[] = [];
  for (const n of numbers) {
    if (!n.phone_e164) { results.push({ id: n.id, skipped: 'no phone' }); continue; }
    try {
      // 1. Look up Twilio number SID
      const lookup = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(n.phone_e164)}`,
        { headers: { Authorization: authHeader } }
      );
      const lookupData = await lookup.json();
      if (lookup.status === 401) {
        results.push({ phone: n.phone_e164, error: '401 — bad TWILIO creds', credential_issue: true });
        continue;
      }
      const numberSid = lookupData?.incoming_phone_numbers?.[0]?.sid;
      if (!numberSid) {
        results.push({ phone: n.phone_e164, error: 'not in Twilio account' });
        continue;
      }

      // 2. Push webhook
      const upd = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers/${numberSid}.json`,
        {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            VoiceUrl: voiceWebhook, VoiceMethod: 'POST',
            StatusCallback: statusWebhook, StatusCallbackMethod: 'POST',
          }),
        }
      );
      if (!upd.ok) {
        const errBody = await upd.text();
        results.push({ phone: n.phone_e164, error: `Twilio ${upd.status}: ${errBody.slice(0, 200)}` });
        continue;
      }

      // 3. Stamp source table (only writable tables we know about)
      const patchBody = JSON.stringify({
        twilio_webhook_configured: true,
        twilio_webhook_configured_at: new Date().toISOString(),
        twilio_sid: numberSid,
        voice_webhook_url: voiceWebhook,
      });
      // dc_phone_numbers uses webhook_url (legacy) + voice_webhook_url shim is in view only.
      // Patch source_table directly.
      const allowed = ['dc_phone_numbers', 'brandaro_phone_numbers', 'business_phone_numbers'];
      if (allowed.includes(n.source_table)) {
        // dc_phone_numbers has `webhook_url` not `voice_webhook_url` — handle separately
        const body = n.source_table === 'dc_phone_numbers'
          ? JSON.stringify({
              twilio_webhook_configured: true,
              twilio_webhook_configured_at: new Date().toISOString(),
              twilio_sid: numberSid,
              webhook_url: voiceWebhook,
            })
          : patchBody;
        await sbFetch(`/rest/v1/${n.source_table}?id=eq.${n.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body,
        });
      }
      results.push({ phone: n.phone_e164, ok: true, number_sid: numberSid });
    } catch (e: any) {
      results.push({ phone: n.phone_e164, error: e.message });
    }
  }

  const failures = results.filter(r => r.error);
  const summary = {
    total: numbers.length,
    configured: results.filter(r => r.ok).length,
    failed: failures.length,
    skipped: results.filter(r => r.skipped).length,
    excluded_brandaro: excludedCount,
  };

  // Persist run for drift/alerting. Cron sets ?triggered_by=cron.
  const url = new URL(req.url);
  const triggeredBy = url.searchParams.get('triggered_by') || 'manual';
  const hasCredIssue = failures.some((f: any) => f.credential_issue);
  await sbFetch('/rest/v1/dc_webhook_assertion_log', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      total: summary.total,
      configured: summary.configured,
      failed: summary.failed,
      excluded_brandaro: summary.excluded_brandaro,
      failures,
      has_credential_issue: hasCredIssue,
      triggered_by: triggeredBy,
    }),
  });

  return new Response(JSON.stringify({ success: true, summary, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
