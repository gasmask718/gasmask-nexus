// ICW Intake — public booking site -> OS
// Receives a booking from the standalone ICW booking site, validates it,
// creates a public.icw_jobs row with status='pending' (which fires the existing
// auto-dispatch trigger) and returns the resulting dispatch outcome.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getIcwConfig } from '../_shared/icwWebhookConfig.ts';

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

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  const expected = await getIcwConfig('ICW_INTAKE_SECRET');
  if (!expected) {
    console.error('[icw-intake] ICW_INTAKE_SECRET is not configured');
    return json({ success: false, error: 'Intake is not configured' }, 500);
  }
  const provided = req.headers.get('x-icw-intake-secret') ?? '';
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }
  if (!payload || typeof payload !== 'object') {
    return json({ success: false, error: 'Body must be a JSON object' }, 400);
  }

  // Health probe: no writes.
  if (payload.healthcheck === true) return json({ success: true, healthcheck: true });

  const category = str(payload.category);
  const state = str(payload.state);
  const address = str(payload.address);
  const missing: string[] = [];
  if (!category) missing.push('category');
  if (!state) missing.push('state');
  if (!address) missing.push('address');
  if (missing.length) {
    return json(
      { success: false, error: `Missing required field(s): ${missing.join(', ')}` },
      400,
    );
  }
  if (state!.length !== 2 || !/^[A-Za-z]{2}$/.test(state!)) {
    return json(
      { success: false, error: `state must be a 2-letter US state code — got '${state}'` },
      400,
    );
  }

  let scheduledAt: string | null = null;
  const rawScheduled = str(payload.scheduled_at);
  if (rawScheduled) {
    const d = new Date(rawScheduled);
    if (Number.isNaN(d.getTime())) {
      return json({ success: false, error: 'scheduled_at must be an ISO-8601 timestamp' }, 400);
    }
    scheduledAt = d.toISOString();
  }

  let price: number | null = null;
  if (payload.price !== null && payload.price !== undefined && payload.price !== '') {
    const n = Number(payload.price);
    if (!Number.isFinite(n) || n < 0) {
      return json({ success: false, error: 'price must be a non-negative number' }, 400);
    }
    price = n;
  }

  const externalBookingId = str(payload.external_booking_id);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Idempotency: the public site's bookings.id is unique on our side.
  if (externalBookingId) {
    const { data: existing, error: exErr } = await supabase
      .from('icw_jobs')
      .select('id, status, assigned_worker_id')
      .eq('external_booking_id', externalBookingId)
      .maybeSingle();
    if (exErr) {
      console.error('[icw-intake] duplicate lookup failed', exErr.message);
      return json({ success: false, error: exErr.message }, 500);
    }
    if (existing) {
      return json({
        success: true,
        duplicate: true,
        job_id: existing.id,
        status: existing.status,
        assigned_worker_id: existing.assigned_worker_id,
        external_booking_id: externalBookingId,
      });
    }
  }

  const row = {
    external_booking_id: externalBookingId,
    category: category!,
    sub_service: str(payload.sub_service),
    state: state!.toUpperCase(),
    address: address!,
    scheduled_at: scheduledAt,
    price,
    customer_name: str(payload.customer_name) ?? str(payload.name),
    customer_phone: str(payload.customer_phone) ?? str(payload.phone),
    customer_email: str(payload.customer_email) ?? str(payload.email),
    status: 'pending' as const,
  };

  const { data: created, error } = await supabase
    .from('icw_jobs')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[icw-intake] insert failed', error.message);
    return json({ success: false, error: error.message }, 500);
  }

  // The auto-dispatch trigger has already run inside the insert transaction —
  // re-read to report the real post-dispatch outcome.
  const { data: after } = await supabase
    .from('icw_jobs')
    .select('id, status, assigned_worker_id')
    .eq('id', created.id)
    .single();

  const { data: log } = await supabase
    .from('icw_dispatch_log')
    .select('event, note, created_at')
    .eq('job_id', created.id)
    .not('event', 'in', '(status_sync_sent,status_sync_failed)')
    .order('created_at', { ascending: false })
    .limit(1);

  return json({
    success: true,
    job_id: created.id,
    external_booking_id: externalBookingId,
    status: after?.status ?? 'pending',
    assigned_worker_id: after?.assigned_worker_id ?? null,
    dispatch_note: log?.[0]?.note ?? null,
  }, 201);
});
