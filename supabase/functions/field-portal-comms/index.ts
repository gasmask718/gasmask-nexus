// Unified field-portal communications (ambassador / driver / biker).
//
// Every call and text from a field portal goes through here so that:
//  1. Store assignment is enforced SERVER-SIDE via public.field_worker_has_store()
//     (explicit assignment OR an active route stop in the last 30 days).
//  2. The store always sees the BUSINESS number, never the worker's personal cell.
//  3. Every action lands in the canonical public.communication_logs so the owner
//     sees driver/biker/ambassador comms in the unified phone log.
//
// Actions: "send_sms" | "start_call"
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { verifiedInsertSoft } from "../_shared/verifiedWrite.ts";
import { recordAttrFor } from "../_shared/recordingConsent.ts";
import { sendSms } from "../_shared/sendSms.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const BUSINESS_NUMBER =
  Deno.env.get('TWILIO_DEFAULT_FROM') || Deno.env.get('TWILIO_PHONE_NUMBER') || '';

const MAX_SMS_PER_DAY = 60;
const MAX_CALLS_PER_DAY = 40;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function e164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (String(raw).trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}

function isQuietHours(): boolean {
  // Approximate US Eastern: allow 8am–9pm.
  const local = (new Date().getUTCHours() - 5 + 24) % 24;
  return local < 8 || local >= 21;
}

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json({ error: 'missing_auth' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'unauthenticated' }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const action = String(body.action || '');
    const storeId = body.store_id as string | undefined;
    if (!storeId) return json({ error: 'store_id required' }, 400);
    if (action !== 'send_sms' && action !== 'start_call') {
      return json({ error: 'unsupported_action' }, 400);
    }

    // ── 1. AUTHORIZATION: is this store assigned to this worker? ──────────
    const { data: allowed, error: authzErr } = await admin.rpc('field_worker_has_store', {
      _user_id: userId,
      _store_id: storeId,
    });
    if (authzErr) return json({ error: authzErr.message }, 500);
    if (allowed !== true) {
      return json(
        { error: 'store_not_assigned', message: 'This store is not assigned to you.' },
        403,
      );
    }

    // ── 2. Resolve store + worker identity ────────────────────────────────
    const { data: store } = await admin
      .from('store_master')
      .select('id, store_name, phone, status')
      .eq('id', storeId)
      .maybeSingle();
    if (!store) return json({ error: 'store_not_found' }, 404);
    if (store.status === 'blacklisted') return json({ error: 'store_blacklisted' }, 403);

    const { data: amb } = await admin
      .from('ambassadors')
      .select('id, name, personal_phone, twilio_number')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: driver } = await admin
      .from('drivers')
      .select('id, full_name, phone')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, phone')
      .eq('id', userId)
      .maybeSingle();

    const actorName =
      amb?.name || driver?.full_name || profile?.full_name || 'Field team member';
    const workerCell = e164(amb?.personal_phone || driver?.phone || profile?.phone);
    const fromNumber = e164(amb?.twilio_number) || e164(BUSINESS_NUMBER);

    if (!fromNumber) return json({ error: 'no_business_number_configured' }, 500);
    if (!TWILIO_SID || !TWILIO_TOKEN) return json({ error: 'twilio_not_configured' }, 500);

    const twilioAuth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // ── 3. SEND SMS ───────────────────────────────────────────────────────
    if (action === 'send_sms') {
      const message = String(body.message || '').trim();
      if (!message) return json({ error: 'message_required' }, 400);
      if (message.length > 1600) return json({ error: 'message_too_long' }, 400);

      const toPhone = e164(body.to_phone || store.phone);
      if (!toPhone) return json({ error: 'no_valid_recipient_phone' }, 400);

      const { count } = await admin
        .from('communication_logs')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)
        .eq('channel', 'sms')
        .gte('created_at', since);
      if ((count ?? 0) >= MAX_SMS_PER_DAY) {
        return json({ error: 'daily_sms_limit_reached', limit: MAX_SMS_PER_DAY }, 429);
      }

      // All egress through send-sms: suppression (dnc_list + opt_out_events +
      // legal STOP), idempotency, outbound_messages audit row. Conversational:
      // a human worker types each message per tap; skipCooldown because the
      // 60/day cap above is the pacing control, not a class cooldown.
      const hourBucket = new Date().toISOString().slice(0, 13);
      const smsResult = await sendSms({
        to: toPhone,
        from: fromNumber,
        body: message,
        sendClass: 'conversational',
        idempotencyKey: `fpc-${userId}-${storeId}-${shortHash(message)}-${hourBucket}`,
        skipCooldown: true,
        purpose: 'field_portal_sms',
        storeId,
        metadata: { source: 'field_portal', actor_name: actorName, contact_id: body.contact_id || null },
      });

      if (smsResult.blocked) {
        // A suppressed text is a NAMED outcome, not a silent skip: the store
        // opted out, the message did not go out, and the worker is told to
        // call instead (an SMS STOP does not block voice).
        console.warn(`[field-portal-comms] BLOCKED ${toPhone} — ${smsResult.errorMessage}`);
        await admin.from('communication_logs').insert({
          store_id: storeId,
          contact_id: body.contact_id || null,
          channel: 'sms',
          direction: 'outbound',
          status: 'blocked',
          delivery_status: 'blocked',
          message_content: message,
          sender_phone: fromNumber,
          recipient_phone: toPhone,
          created_by: userId,
          ambassador_id: amb?.id || null,
          driver_id: driver?.id || null,
          outcome: 'field_sms_suppressed',
          notes: `Suppressed: ${smsResult.errorMessage}. Store is still reachable by call.`,
          metadata: { source: 'field_portal', actor_name: actorName, blocker: smsResult.errorCode },
        });
        return json({
          ok: false,
          suppressed: true,
          reason: smsResult.errorMessage,
          message: 'This store has opted out of texts. The message was not sent — call instead.',
        }, 200);
      }

      if (!smsResult.success) {
        console.error('[field-portal-comms] send-sms failed', smsResult.status, smsResult.errorMessage);
        return json(
          { error: 'sms_failed', status: smsResult.status, details: smsResult.errorMessage || 'send failed' },
          502,
        );
      }

      const twData = { status: 'sent', sid: smsResult.providerMessageId };

      const { data: log, error: logErr } = await admin
        .from('communication_logs')
        .insert({
          store_id: storeId,
          contact_id: body.contact_id || null,
          channel: 'sms',
          direction: 'outbound',
          status: twData.status || 'sent',
          delivery_status: twData.status || 'sent',
          message_content: message,
          sender_phone: fromNumber,
          recipient_phone: toPhone,
          sent_at: new Date().toISOString(),
          created_by: userId,
          ambassador_id: amb?.id || null,
          driver_id: driver?.id || null,
          twilio_message_sid: twData.sid,
          metadata: { source: 'field_portal', actor_name: actorName },
        })
        .select('id')
        .single();
      if (logErr) console.error('[field-portal-comms] log insert failed', logErr);

      if (amb?.id) {
        await verifiedInsertSoft(admin, 'log field portal SMS', (c: any) =>
          c.from('ambassador_activity_log').insert({
            ambassador_id: amb.id,
            store_id: storeId,
            action_type: 'sms_sent',
            metadata: { source: 'field_portal', twilio_sid: twData.sid },
          }));
      }

      return json({ ok: true, log_id: log?.id ?? null, twilio_sid: twData.sid });
    }

    // ── 4. START CALL (bridge: ring the worker, then dial the store) ──────
    if (isQuietHours()) {
      return json({ error: 'quiet_hours', message: 'Calls allowed 8am–9pm ET.' }, 429);
    }
    if (!workerCell) {
      return json(
        {
          error: 'no_personal_phone',
          message: 'Add your phone number in Profile before placing calls.',
        },
        400,
      );
    }
    const storePhone = e164(body.to_phone || store.phone);
    if (!storePhone) return json({ error: 'no_valid_recipient_phone' }, 400);

    const { count: callCount } = await admin
      .from('communication_logs')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId)
      .eq('channel', 'voice')
      .gte('created_at', since);
    if ((callCount ?? 0) >= MAX_CALLS_PER_DAY) {
      return json({ error: 'daily_call_limit_reached', limit: MAX_CALLS_PER_DAY }, 429);
    }

    const { data: log } = await admin
      .from('communication_logs')
      .insert({
        store_id: storeId,
        contact_id: body.contact_id || null,
        channel: 'voice',
        direction: 'outbound',
        call_type: 'direct',
        status: 'dialing',
        started_at: new Date().toISOString(),
        sender_phone: fromNumber,
        recipient_phone: storePhone,
        created_by: userId,
        ambassador_id: amb?.id || null,
        driver_id: driver?.id || null,
        notes: body.notes || null,
        metadata: { source: 'field_portal', actor_name: actorName },
      })
      .select('id')
      .single();

    const safeName = String(store.store_name || 'the store').replace(/[<>&"']/g, '');
    // Recording consent gate: fail closed. The "this call is recorded" Say is
    // heard by the worker leg only, so it is NOT an all-party announcement.
    const { attr: recAttr, decision: recDecision } = await recordAttrFor(admin, storePhone, {
      mode: 'record-from-answer',
    });
    console.log(`[field-portal-comms] recording=${recAttr ? 'on' : 'off'} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ''})`);
    const twiml =
      `<Response><Say voice="Polly.Joanna">${recAttr ? 'This call is recorded. ' : ''}Connecting you to ${safeName}.</Say>` +
      `<Dial callerId="${fromNumber}"${recAttr} timeout="25">` +
      `<Number>${storePhone}</Number></Dial></Response>`;

    const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
    const form = new URLSearchParams({
      To: workerCell,
      From: fromNumber,
      Twiml: twiml,
      StatusCallback: `https://${projectRef}.functions.supabase.co/twilio-call-status?log_id=${log?.id}`,
      Record: recAttr ? 'true' : 'false',
    });
    ['initiated', 'ringing', 'answered', 'completed'].forEach((ev) =>
      form.append('StatusCallbackEvent', ev),
    );

    const tw = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      },
    );
    const twData = await tw.json();
    if (!tw.ok) {
      console.error('[field-portal-comms] twilio call failed', tw.status, twData);
      if (log?.id) {
        await admin
          .from('communication_logs')
          .update({ status: 'failed', notes: `Twilio: ${twData?.message || 'error'}` })
          .eq('id', log.id);
      }
      return json(
        { error: 'twilio_error', status: tw.status, details: twData?.message || twData },
        tw.status,
      );
    }

    if (log?.id) {
      await admin
        .from('communication_logs')
        .update({ twilio_call_sid: twData.sid })
        .eq('id', log.id);
    }
    if (amb?.id) {
      await verifiedInsertSoft(admin, 'log field portal call', (c: any) =>
        c.from('ambassador_activity_log').insert({
          ambassador_id: amb.id,
          store_id: storeId,
          action_type: 'direct_call_initiated',
          metadata: { source: 'field_portal', twilio_call_sid: twData.sid },
        }));
    }

    return json({
      ok: true,
      log_id: log?.id ?? null,
      twilio_call_sid: twData.sid,
      message: 'Your phone will ring shortly — answer to be connected to the store.',
    });
  } catch (err) {
    console.error('[field-portal-comms] unhandled', err);
    return json({ error: err instanceof Error ? err.message : 'unknown_error' }, 500);
  }
});
