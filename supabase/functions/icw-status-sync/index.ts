// ICW Status Sync — OS -> public booking site
// Invoked by the icw_jobs status-change trigger (via pg_net). Forwards the new
// status to the public site's webhook and logs the outcome to icw_dispatch_log.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  const sharedSecret = Deno.env.get('ICW_STATUS_SYNC_SECRET');
  if (!sharedSecret) {
    console.error('[icw-status-sync] ICW_STATUS_SYNC_SECRET is not configured');
    return json({ success: false, error: 'Status sync is not configured' }, 500);
  }
  const provided = req.headers.get('x-icw-status-secret') ?? '';
  if (!provided || !timingSafeEqual(provided, sharedSecret)) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  if (payload?.healthcheck === true) return json({ success: true, healthcheck: true });

  const jobId = typeof payload.job_id === 'string' ? payload.job_id : null;
  const externalBookingId =
    typeof payload.external_booking_id === 'string' ? payload.external_booking_id : null;
  const status = typeof payload.status === 'string' ? payload.status : null;

  if (!jobId || !status || !externalBookingId) {
    return json(
      { success: false, error: 'job_id, status and external_booking_id are required' },
      400,
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const log = async (event: string, note: string) => {
    const { error } = await supabase
      .from('icw_dispatch_log')
      .insert({ job_id: jobId, event, note: note.slice(0, 2000) });
    if (error) console.error('[icw-status-sync] log write failed', error.message);
  };

  const target = Deno.env.get('PUBLIC_SITE_STATUS_WEBHOOK_URL');
  if (!target || !/^https:\/\//.test(target)) {
    await log(
      'status_sync_failed',
      `PUBLIC_SITE_STATUS_WEBHOOK_URL not configured — status '${status}' not delivered for booking ${externalBookingId}`,
    );
    return json({ success: false, delivered: false, error: 'Public site webhook URL not configured' }, 503);
  }

  const body = {
    job_id: jobId,
    external_booking_id: externalBookingId,
    status,
    assigned_worker_id: payload.assigned_worker_id ?? null,
    previous_status: payload.previous_status ?? null,
    changed_at: payload.changed_at ?? new Date().toISOString(),
  };

  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-icw-status-secret': sharedSecret,
      },
      body: JSON.stringify(body),
    });
    const text = (await res.text()).slice(0, 500);
    if (!res.ok) {
      await log(
        'status_sync_failed',
        `HTTP ${res.status} from public site for status '${status}' (booking ${externalBookingId}): ${text}`,
      );
      return json({ success: false, delivered: false, public_site_status: res.status, body: text }, 502);
    }
    await log(
      'status_sync_sent',
      `status '${status}' delivered for booking ${externalBookingId} (HTTP ${res.status})`,
    );
    return json({ success: true, delivered: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log(
      'status_sync_failed',
      `network error delivering status '${status}' for booking ${externalBookingId}: ${msg}`,
    );
    return json({ success: false, delivered: false, error: msg }, 502);
  }
});
