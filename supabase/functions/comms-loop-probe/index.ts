// Read-only Brandaro phantom probe + live outbound SMS loopback test.
// GET ?probe=1  -> classify the 16 Brandaro numbers as PURCHASED vs PHANTOM
// POST {to, from?, body?} -> send one real SMS via main Twilio + log it
//
// No DB writes for the probe path. SMS path inserts ONE row in communication_logs.

import { sendTwilioSms } from "../_shared/twilioSend.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_SR  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const BRANDARO_NUMBERS: { name: string; e164: string; db_sid: string | null }[] = [
  { name: 'Brandaro AI Line',    e164: '+18888636609', db_sid: 'PNa27c79e15606bef58a4fa0f7fc6a827c' },
  { name: 'Brandaro Arizona',    e164: '+16027371645', db_sid: 'PN184db9dbef3749a9d6f2fc83f5ab54ca' },
  { name: 'Brandaro California 1', e164: '+12132978049', db_sid: 'PN1f34de9e3ef409c62f5f7c94788ee578' },
  { name: 'Brandaro California 2', e164: '+12135834490', db_sid: 'PNabcb9de3658d0a40a524d16eddbdd4be' },
  { name: 'BRANDARO DALLAS 1',   e164: '+12142394316', db_sid: null },
  { name: 'Brandaro Florida 1',  e164: '+13055207414', db_sid: 'PN54c8f7541c7dec5ca33157e48c323d82' },
  { name: 'Brandaro Georgia 1',  e164: '+14709314883', db_sid: 'PN7714d9a0c872fd023c65641f1a4487cb' },
  { name: 'Brandaro Georgia 2',  e164: '+14048009371', db_sid: 'PNddb4ab106b16d3d721984b2d75c5510d' },
  { name: 'Brandaro Illinois',   e164: '+18472389630', db_sid: 'PN680e251a0440c5991fa2db4c01de65de' },
  { name: 'Brandaro New Jersey', e164: '+18483588206', db_sid: 'PNa33a8369e2309fc803511310ab2ef459' },
  { name: 'Brandaro New York 1', e164: '+19292389353', db_sid: 'PN54d8d09ea52a57e74a12a07b58b3ae86' },
  { name: 'Brandaro New York 2', e164: '+19296746727', db_sid: 'PN874efd30f2632a3974c0c46ac7917219' },
  { name: 'Brandaro New York 3', e164: '+19296613201', db_sid: 'PNebbc7bfff3fff801d2d9bc5fe715b4df' },
  { name: 'Brandaro New York 4', e164: '+19295727822', db_sid: 'PNd8028bc598f67ffe3222a7b9101366fe' },
  { name: 'Brandaro New York 5', e164: '+19296598565', db_sid: 'PN15a8010c90ef51a65eb53e182714403f' },
  { name: 'Brandaro Toll-Free',  e164: '+18887598857', db_sid: 'PN1e1e5dd4201f1a204a9099de4a672a12' },
];

function basic() { return `Basic ${btoa(`${SID}:${TOKEN}`)}`; }

async function probeOne(e164: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(e164)}`;
  const r = await fetch(url, { headers: { Authorization: basic() } });
  const body = await r.json().catch(() => ({}));
  const list = (body as any)?.incoming_phone_numbers ?? [];
  if (!r.ok) return { status: r.status, classification: 'ERROR', error: body };
  if (list.length === 0) return { status: r.status, classification: 'PHANTOM', live_sid: null };
  return {
    status: r.status,
    classification: 'PURCHASED',
    live_sid: list[0].sid,
    voice_url: list[0].voice_url,
    sms_url: list[0].sms_url,
  };
}

async function runProbe() {
  const results = [];
  for (const n of BRANDARO_NUMBERS) {
    const p = await probeOne(n.e164);
    const sid_match = (p as any).live_sid && n.db_sid ? (p as any).live_sid === n.db_sid : null;
    results.push({ ...n, ...p, db_sid_matches_live: sid_match });
  }
  const purchased = results.filter(r => r.classification === 'PURCHASED').length;
  const phantom = results.filter(r => r.classification === 'PHANTOM').length;
  const errored = results.filter(r => r.classification === 'ERROR').length;
  return { summary: { total: results.length, purchased, phantom, errored }, results };
}

// Group B (test harness). Routed through the shared module so the class is
// explicit and logged; the probe still reaches Twilio in process, because its
// whole job is to test that credential.
async function sendSms(to: string, from: string, body: string) {
  const r = await sendTwilioSms({
    to,
    body,
    from,
    suppressionClass: "test",
    source: "comms-loop-probe",
  });
  return {
    status: r.success ? 201 : 0,
    ok: r.success,
    sid: r.sid,
    body: { status: r.status, error: r.errorMessage ?? null, code: r.errorCode ?? null },
  };
}

async function logComm(row: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/communication_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SB_SR,
      Authorization: `Bearer ${SB_SR}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, row: j };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);

  try {
    if (url.searchParams.get('probe') === '1' || req.method === 'GET') {
      const out = await runProbe();
      return new Response(JSON.stringify(out, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const payload = await req.json().catch(() => ({}));
      const to = payload.to || '+17183089391';

      // Safe default: verified toll-free. Reject US long codes unless a
      // MessagingServiceSid is configured — they get silently dropped by
      // carriers (Twilio error 30034) without A2P 10DLC registration.
      const VERIFIED_TF = '+18776818621';
      const isUsTF = (n: string) => /^\+1(800|833|844|855|866|877|888)\d{7}$/.test(n);
      const isUsLongCode = (n: string) => /^\+1\d{10}$/.test(n) && !isUsTF(n);
      const hasMsgSvc = !!Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
      const a2pBypass = Deno.env.get('TWILIO_A2P_BYPASS') === 'true';

      const requested = payload.from
        || Deno.env.get('TWILIO_FROM_NUMBER')
        || Deno.env.get('TWILIO_PHONE_NUMBER')
        || VERIFIED_TF;
      const isUsDest = to.startsWith('+1');
      let from = requested;
      let fromSwapped: string | null = null;
      if (isUsDest && isUsLongCode(from) && !hasMsgSvc && !a2pBypass) {
        fromSwapped = from;
        from = VERIFIED_TF;
        console.warn(`🚫 comms-loop-probe: rejected long code ${fromSwapped} → using verified TF ${VERIFIED_TF} (A2P 30034 guard)`);
      }

      const body = payload.body
        || `Loop test ${new Date().toISOString().slice(11,19)} UTC — reply YES to confirm webhook routing.`;

      if (!from) {
        return new Response(JSON.stringify({ error: 'no FROM number resolved' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const sendRes = await sendSms(to, from, body);
      let logRes: unknown = { skipped: 'send failed' };
      if (sendRes.ok) {
        logRes = await logComm({
          channel: 'sms',
          direction: 'outbound',
          summary: 'Live loop probe SMS',
          message_content: body,
          full_message: body,
          recipient_phone: to,
          sender_phone: from,
          twilio_sid: sendRes.sid,
          delivery_status: 'sent',
          performed_by: 'system',
          status: 'sent',
        });
      }

      return new Response(JSON.stringify({ send: sendRes, log: logRes }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
