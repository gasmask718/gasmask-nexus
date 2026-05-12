// Streams Brandaro Twilio recordings through our backend so the admin's
// browser <audio> tag can play them without ever prompting for a Twilio
// login. Public function (verify_jwt = false) so HTML media elements work.
//
// Usage:
//   GET /functions/v1/brandaro-recording-proxy?url=<full twilio url>
//   GET /functions/v1/brandaro-recording-proxy?sid=REabc123&fmt=mp3
//   GET /functions/v1/brandaro-recording-proxy?call_log_id=<uuid>
//
// Auth uses BRANDARO_TWILIO_ACCOUNT_SID / BRANDARO_TWILIO_AUTH_TOKEN, falling
// back to the workspace-default TWILIO_* secrets so legacy rows still play.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges, content-type',
};

const TWILIO_HOST_RE = /(^|\.)twilio\.com$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let target = url.searchParams.get('url') || '';
    const sid = url.searchParams.get('sid');
    const callLogId = url.searchParams.get('call_log_id');
    const fmt = (url.searchParams.get('fmt') || 'mp3').toLowerCase();

    const brandaroSid = Deno.env.get('BRANDARO_TWILIO_ACCOUNT_SID');
    const brandaroToken = Deno.env.get('BRANDARO_TWILIO_AUTH_TOKEN');
    const fallbackSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const fallbackToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    // Resolve target from call_log_id by hitting the DB with service role.
    if (!target && !sid && callLogId) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data } = await admin
        .from('va_call_logs')
        .select('recording_url, recording_sid')
        .eq('id', callLogId)
        .maybeSingle();
      if (data?.recording_url) target = data.recording_url;
      else if (data?.recording_sid && brandaroSid) {
        target = `https://api.twilio.com/2010-04-01/Accounts/${brandaroSid}/Recordings/${data.recording_sid}.${fmt}`;
      }
    }

    if (!target && sid) {
      const useSid = brandaroSid || fallbackSid;
      if (!useSid) return json({ error: 'Twilio account SID not configured' }, 500);
      target = `https://api.twilio.com/2010-04-01/Accounts/${useSid}/Recordings/${sid}.${fmt}`;
    }

    if (!target) return json({ error: 'Missing url, sid, or call_log_id parameter' }, 400);

    let parsed: URL;
    try { parsed = new URL(target); } catch { return json({ error: 'Invalid url' }, 400); }
    if (!TWILIO_HOST_RE.test(parsed.hostname)) {
      return json({ error: 'Only twilio.com URLs allowed' }, 400);
    }
    if (/\/Recordings\/RE[a-f0-9]+$/i.test(parsed.pathname)) {
      parsed.pathname += `.${fmt}`;
    }

    // Pick the credential that matches the account SID embedded in the URL.
    const accountMatch = parsed.pathname.match(/\/Accounts\/(AC[a-f0-9]+)/i);
    const urlAccountSid = accountMatch?.[1];
    let useSid = brandaroSid;
    let useToken = brandaroToken;
    if (urlAccountSid && fallbackSid && urlAccountSid.toLowerCase() === fallbackSid.toLowerCase()) {
      useSid = fallbackSid; useToken = fallbackToken;
    }
    if (!useSid || !useToken) {
      // Last resort fallback
      useSid = useSid || fallbackSid; useToken = useToken || fallbackToken;
    }
    if (!useSid || !useToken) return json({ error: 'Twilio credentials not configured' }, 500);

    const headers: Record<string, string> = {
      Authorization: 'Basic ' + btoa(`${useSid}:${useToken}`),
    };
    const range = req.headers.get('range');
    if (range) headers['Range'] = range;

    const upstream = await fetch(parsed.toString(), { headers, redirect: 'follow' });
    const out = new Headers(corsHeaders);
    for (const h of ['content-type','content-length','content-range','accept-ranges','last-modified','etag']) {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    }
    if (!out.get('content-type')) out.set('content-type', fmt === 'wav' ? 'audio/wav' : 'audio/mpeg');
    out.set('cache-control', 'private, max-age=3600');

    return new Response(upstream.body, { status: upstream.status, headers: out });
  } catch (e) {
    console.error('[brandaro-recording-proxy]', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
