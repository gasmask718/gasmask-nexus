// Twilio status callback for direct ambassador bridge calls AND browser
// (Voice SDK) calls placed from a store profile.
//
// Previously this bailed when no communication_logs row existed for the SID,
// which meant every browser-placed call vanished — the store profile had no
// call history. It now creates the row on first callback and resolves the
// store by phone number so calls thread onto the right store.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { readForm, verifyTwilio } from '../_shared/dialer.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const last10 = (v: string) => v.replace(/\D/g, '').slice(-10);

/** Resolve store_id + contact_id from the counterparty number. */
async function resolveStore(admin: any, phone: string) {
  // Safe resolution: a guessed id is worse than a null one. Anything that
  // matches more than one store stays NULL — the BEFORE INSERT trigger
  // public.autolink_communication_log() then resolves it conversation-first
  // and flags what it cannot prove. Never "first match wins".
  const p10 = last10(phone);
  const none = { store_id: null, contact_id: null, ambiguous: false };
  if (p10.length !== 10) return none;

  const { data: contacts } = await admin
    .from('store_contacts')
    .select('id, store_id')
    .is('deleted_at', null)
    .not('store_id', 'is', null)
    .ilike('phone', `%${p10}`)
    .limit(50);
  const rows = (contacts || []) as { id: string; store_id: string }[];
  if (rows.length === 1) return { store_id: rows[0].store_id, contact_id: rows[0].id, ambiguous: false };
  if (rows.length > 1) {
    const stores = new Set(rows.map((c) => c.store_id));
    return stores.size === 1
      ? { store_id: rows[0].store_id, contact_id: null, ambiguous: true }
      : { store_id: null, contact_id: null, ambiguous: true };
  }

  const { data: storeRows } = await admin
    .from('stores')
    .select('id')
    .ilike('phone', `%${p10}`)
    .limit(50);
  const list = (storeRows || []) as { id: string }[];
  if (list.length === 1) return { store_id: list[0].id, contact_id: null, ambiguous: false };
  if (list.length > 1) return { store_id: null, contact_id: null, ambiguous: true };
  return none;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const logIdParam = url.searchParams.get('log_id');
    // SEC-018: Twilio request signature is required. Without it, anyone who
    // knows this URL can POST fabricated call outcomes into communication_logs.
    const params = await readForm(req);
    const v = verifyTwilio(req, params);
    if (!v.ok) {
      console.error('[twilio-call-status] rejected unsigned request:', v.reason);
      return new Response(JSON.stringify({ error: 'invalid_twilio_signature', reason: v.reason }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const form = { get: (k: string) => params[k] ?? null };
    const callSid = String(form.get('CallSid') || '');
    const status = String(form.get('CallStatus') || '');
    const duration = Number(form.get('CallDuration') || 0);
    const answeredBy = String(form.get('AnsweredBy') || '');
    const recordingUrl = String(form.get('RecordingUrl') || '');
    const fromNumber = String(form.get('From') || '');
    const toNumber = String(form.get('To') || '');
    const rawDirection = String(form.get('Direction') || '');
    const direction = rawDirection.startsWith('inbound') ? 'inbound' : 'outbound';

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Locate log row by sid or fallback to log_id
    let logId = logIdParam;
    if (!logId && callSid) {
      const { data: row } = await admin
        .from('communication_logs')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();
      logId = row?.id ?? null;
    }

    // ── No row yet: this is a browser/Voice-SDK call that was never pre-logged.
    //    Create it now so the store profile gets a call history entry. ──
    if (!logId && callSid) {
      const counterparty = direction === 'inbound' ? fromNumber : toNumber;
      const { store_id, contact_id, ambiguous } = await resolveStore(admin, counterparty);

      const { data: created, error: createErr } = await admin
        .from('communication_logs')
        .insert({
          channel: 'call',
          direction,
          store_id,
          contact_id,
          twilio_call_sid: callSid,
          sender_phone: fromNumber || null,
          recipient_phone: toNumber || null,
          summary:
            direction === 'inbound'
              ? `Inbound call from ${fromNumber || 'unknown number'}`
              : 'Call placed from browser',
          event_type: direction === 'inbound' ? 'inbound_call' : 'outbound_call',
          follow_up_required: ambiguous ? true : undefined,
          metadata: { phone_ambiguous: ambiguous },
          status: 'initiated',
          delivery_status: 'initiated',
          started_at: new Date().toISOString(),
          source_table: store_id ? 'stores' : null,
          source_id: store_id,
          source_business: 'gasmask',
        })
        .select('id')
        .maybeSingle();

      if (createErr) {
        console.error('[twilio-call-status] could not create log row', createErr);
      } else {
        logId = created?.id ?? null;
        console.log(
          `[twilio-call-status] created log ${logId} sid=${callSid} store=${store_id || 'unmatched'}`,
        );
      }
    }

    if (!logId) return new Response('ok', { status: 200 });

    const updates: any = { twilio_call_sid: callSid || undefined };
    if (status === 'ringing') updates.status = 'ringing';
    if (status === 'in-progress' || status === 'answered') { updates.status = 'in_progress'; updates.answered_at = new Date().toISOString(); }
    if (status === 'completed') {
      updates.status = 'complete';
      updates.ended_at = new Date().toISOString();
      updates.duration_seconds = duration;
      if (answeredBy.startsWith('machine')) updates.outcome = 'voicemail';
      else if (answeredBy === 'human') updates.outcome = 'answered';
      else updates.outcome = 'answered';
    }
    if (status === 'no-answer') { updates.status = 'complete'; updates.outcome = 'no_answer'; updates.ended_at = new Date().toISOString(); }
    if (status === 'busy') { updates.status = 'complete'; updates.outcome = 'busy'; updates.ended_at = new Date().toISOString(); }
    if (status === 'failed' || status === 'canceled') { updates.status = 'failed'; updates.outcome = 'failed'; updates.ended_at = new Date().toISOString(); }
    if (recordingUrl) updates.recording_url = `${recordingUrl}.mp3`;

    const { error: updErr } = await admin.from('communication_logs').update(updates).eq('id', logId);
    if (updErr) console.error('[twilio-call-status] update failed', updErr);
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('twilio-call-status error', e);
    return new Response('ok', { status: 200 });
  }
});
