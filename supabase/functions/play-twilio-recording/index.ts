// Streams a Twilio recording (or transcript) through our backend so the
// browser <audio> element can play it without prompting for Twilio login.
//
// ACCESS CONTROLLED: recordings are sensitive. The caller must present a
// valid Supabase session — either an Authorization: Bearer header, or a
// ?token= query param (needed because <audio src> cannot set headers) —
// and hold one of the roles below. Anonymous access is rejected with 401/403.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges, content-type',
};

const ALLOWED_ROLES = ['owner', 'admin', 'developer', 'va', 'staff'];

/** Returns null when authorized, or a Response when the caller is denied. */
async function authorize(req: Request, url: URL): Promise<Response | null> {
  const headerToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const token = headerToken || url.searchParams.get('token') || '';

  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (!token) return deny(401, 'Authentication required to access call recordings');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  const { data: claims, error } = await supabase.auth.getClaims(token);
  const userId = claims?.claims?.sub as string | undefined;
  if (error || !userId) return deny(401, 'Invalid or expired session');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: roles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const has = (roles || []).some((r: { role: string }) => ALLOWED_ROLES.includes(r.role));
  if (!has) {
    console.warn(`[play-twilio-recording] user ${userId} denied — roles=${JSON.stringify(roles)}`);
    return deny(403, 'You do not have permission to listen to call recordings');
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    const denied = await authorize(req, url);
    if (denied) return denied;

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

    // Only allow proxying twilio.com hosts, or objects in our own private
    // `call-recordings` storage bucket (103 legacy VA rows point there; the
    // bucket was flipped private on 2026-08-18 so the raw URL now 400s).
    let parsed: URL;
    try { parsed = new URL(target); } catch {
      return new Response(JSON.stringify({ error: 'Invalid url' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const storageMatch = parsed.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign|authenticated)\/call-recordings\/(.+)$/,
    );
    if (storageMatch) {
      // Caller is already authenticated and role-checked above. Sign a short
      // lived URL with the service role and stream the bytes back.
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const objectPath = decodeURIComponent(storageMatch[1].split('?')[0]);
      const { data: signed, error: signErr } = await admin.storage
        .from('call-recordings')
        .createSignedUrl(objectPath, 300);
      if (signErr || !signed?.signedUrl) {
        return new Response(JSON.stringify({ error: signErr?.message || 'Recording not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const range = req.headers.get('range');
      const up = await fetch(signed.signedUrl, range ? { headers: { Range: range } } : undefined);
      const h = new Headers(corsHeaders);
      for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag']) {
        const v = up.headers.get(k);
        if (v) h.set(k, v);
      }
      if (!h.get('content-type')) h.set('content-type', 'audio/mpeg');
      h.set('cache-control', 'private, max-age=300');
      return new Response(up.body, { status: up.status, headers: h });
    }

    if (!/(^|\.)twilio\.com$/.test(parsed.hostname)) {
      return new Response(JSON.stringify({ error: 'Only twilio.com or call-recordings storage URLs allowed' }), {
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
