// Bridges an ambassador's personal phone to a store via Twilio.
// No calling time window — ambassadors call on their own schedule (2026-08-22
// decision). Daily volume cap (300/day) kept purely as a runaway-loop safety net.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { verifiedInsertSoft } from "../_shared/verifiedWrite.ts";
import { recordAttrFor } from "../_shared/recordingConsent.ts";
import { captureQuickContact } from "../_shared/quickContact.ts";

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const DAILY_CALL_LIMIT = 300;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims?.sub) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const userId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { store_id, notes, to_phone } = await req.json();
    if (!store_id && !to_phone) return new Response(JSON.stringify({ error: 'store_id or to_phone required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: amb } = await admin.from('ambassadors').select('id, personal_phone, phone_primary, twilio_number, name, is_active').eq('user_id', userId).maybeSingle();
    if (!amb?.is_active) return new Response(JSON.stringify({ error: 'Ambassador not active' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    // personal_phone is preferred; phone_primary is the fallback — every live
    // ambassador row currently has personal_phone empty, so without the
    // fallback no direct call could ever fire.
    const ambPhone = amb.personal_phone || amb.phone_primary;
    if (!ambPhone) return new Response(JSON.stringify({ error: 'Add your phone number in Settings before placing direct calls', code: 'NO_PERSONAL_PHONE' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Two targets: an assigned store (store_id) or a raw street number from the
    // quick-dial pad (to_phone, no store yet). The quick path skips store
    // ownership checks — there is no store — but keeps the ambassador-active,
    // daily-cap and recording-consent gates below.
    let targetPhone: string;
    let targetName = 'your new contact';
    if (store_id) {
      const { data: store } = await admin.from('store_master').select('id, store_name, phone, assigned_ambassador_id, status').eq('id', store_id).maybeSingle();
      if (!store) return new Response(JSON.stringify({ error: 'Store not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      // Unified assignment rule (explicit assignment OR active route stop) — same
      // check used by RLS and the field portal, instead of the legacy
      // store_master.assigned_ambassador_id pointer only.
      const { data: isAssigned } = await admin.rpc('field_worker_has_store', { _user_id: userId, _store_id: store_id });
      if (isAssigned !== true) return new Response(JSON.stringify({ error: 'Store not assigned to you' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!store.phone) return new Response(JSON.stringify({ error: 'Store missing phone number' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (store.status === 'blacklisted') return new Response(JSON.stringify({ error: 'Store is blacklisted' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      targetPhone = store.phone;
      targetName = store.store_name;
    } else {
      const digits = String(to_phone).replace(/\D/g, '');
      if (digits.length < 10) return new Response(JSON.stringify({ error: 'A valid 10-digit phone number is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      targetPhone = '+1' + digits.slice(-10);
    }

    // Daily limit — safety net against runaway loops only; not a calling window.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('communication_logs').select('*', { count: 'exact', head: true }).eq('ambassador_id', amb.id).eq('call_type', 'direct').gte('created_at', since);
    if ((count ?? 0) >= DAILY_CALL_LIMIT) {
      return new Response(
        JSON.stringify({ error: `Daily direct call limit reached — ambassadors are capped at ${DAILY_CALL_LIMIT} calls per 24 hours. Contact an admin if you believe this is wrong.` }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Pre-create log row
    const { data: log } = await admin.from('communication_logs').insert({
      ambassador_id: amb.id, store_id: store_id ?? null, channel: 'voice', direction: 'outbound',
      call_type: 'direct', status: 'dialing', started_at: new Date().toISOString(),
      notes, sender_phone: amb.twilio_number, recipient_phone: targetPhone,
      ...(store_id ? {} : { metadata: { source: 'quick_dial' } }),
    }).select('id').single();

    // TwiML to dial store when ambassador answers
    const callerId = amb.twilio_number || Deno.env.get('TWILIO_PHONE_NUMBER')!;
    // Recording consent gate: fail closed unless the store's jurisdiction is
    // known and one-party. See _shared/recordingConsent.ts.
    const { attr: recAttr, decision: recDecision } = await recordAttrFor(admin, targetPhone, {
      mode: 'record-from-answer',
    });
    console.log(`[ambassador-direct-call] recording=${recAttr ? 'on' : 'off'} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ''})`);
    const twiml = `<Response><Say voice="Polly.Joanna">Connecting you to ${targetName.replace(/[<>&"']/g, '')}</Say><Dial callerId="${callerId}"${recAttr} timeout="25"><Number>${targetPhone}</Number></Dial></Response>`;
    const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
    const statusCb = `https://${projectRef}.functions.supabase.co/twilio-call-status?log_id=${log!.id}`;

    const form = new URLSearchParams({
      To: ambPhone, From: callerId, Twiml: twiml,
      StatusCallback: statusCb,
      // Outer-leg recording follows the same gate.
      Record: recAttr ? 'true' : 'false',
    });
    ['initiated', 'ringing', 'answered', 'completed'].forEach((e) => form.append('StatusCallbackEvent', e));

    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const tw = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`, {
      method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    });
    const twData = await tw.json();
    if (!tw.ok) {
      await admin.from('communication_logs').update({ status: 'failed', notes: `Twilio: ${twData.message || 'error'}` }).eq('id', log!.id);
      return new Response(JSON.stringify({ error: twData.message || 'Twilio error', detail: twData }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await admin.from('communication_logs').update({ twilio_call_sid: twData.sid }).eq('id', log!.id);
    await verifiedInsertSoft(admin, 'log ambassador direct call', (c: any) => c.from('ambassador_activity_log').insert({ ambassador_id: amb.id, store_id: store_id ?? null, action_type: 'direct_call_initiated', metadata: { twilio_call_sid: twData.sid, source: store_id ? 'store_profile' : 'quick_dial' } }));

    // Quick-dial: capture the number the moment the call fires. If the
    // ambassador gets interrupted mid-conversation, the number is already safe.
    let quickContactId: string | null = null;
    if (!store_id) {
      quickContactId = await captureQuickContact(admin, {
        ambassadorId: amb.id, ambassadorName: amb.name, phone: targetPhone, firstAction: 'called',
      });
    }

    return new Response(JSON.stringify({ success: true, log_id: log!.id, twilio_call_sid: twData.sid, quick_contact_id: quickContactId, message: 'Your phone will ring shortly. Answer to connect.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('direct-call error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
