// Streams a Twilio recording (or transcript) through our backend so the
// browser <audio> element can play it without prompting for Twilio login.
// Public function — no JWT required (config in supabase/config.toml).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Accept either ?url=<full twilio url> or ?sid=<RecordingSid>&fmt=mp3
    let target = url.searchParams.get('url') || '';
    const sid = url.searchParams.get('sid');
    const fmt = (url.searchParams.get('fmt') || 'mp3').toLowerCase();

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!target && sid) {
      target = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}.${fmt}`;
    }

    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing url or sid parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only allow proxying twilio.com hosts
    let parsed: URL;
    try { parsed = new URL(target); } catch {
      return new Response(JSON.stringify({ error: 'Invalid url' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!/(^|\.)twilio\.com$/.test(parsed.hostname)) {
      return new Response(JSON.stringify({ error: 'Only twilio.com URLs allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure mp3 extension if proxying a bare Recording resource URL
    if (/\/Recordings\/RE[a-f0-9]+$/i.test(parsed.pathname)) {
      parsed.pathname += `.${fmt}`;
    }

    const basicAuth = 'Basic ' + btoa(`${accountSid}:${authToken}`);
    const upstreamHeaders: Record<string, string> = { Authorization: basicAuth };
    const range = req.headers.get('range');
    if (range) upstreamHeaders['Range'] = range;

    const upstream = await fetch(parsed.toString(), { headers: upstreamHeaders, redirect: 'follow' });

    const headers = new Headers(corsHeaders);
    const passThrough = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];
    for (const h of passThrough) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.get('content-type')) {
      headers.set('content-type', fmt === 'wav' ? 'audio/wav' : 'audio/mpeg');
    }
    headers.set('cache-control', 'private, max-age=3600');

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    console.error('[play-twilio-recording] error', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
