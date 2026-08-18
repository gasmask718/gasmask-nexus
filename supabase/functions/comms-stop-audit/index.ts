// Read-only Twilio routing audit + controlled STOP loopback test.
//
// GET  ?action=services   -> enumerate Messaging Services, their inbound_request_url,
//                            use_inbound_webhook_on_number flag, and their number pools.
// GET  ?action=numbers    -> enumerate ALL IncomingPhoneNumbers (sms_url / sms_application_sid)
//                            and diff against dc_phone_numbers.sms_webhook_url.
// POST ?action=backfill   -> write live sms_url into dc_phone_numbers.sms_webhook_url.
// POST ?action=snapshot   -> counts of dnc_list / opt_out_events / store_contacts.opted_out.
// POST ?action=stop_test  -> send a literal "STOP" from one owned number to a target number
//                            so the real inbound webhook fires. Body: { to?, from? }
//
// Everything except backfill/stop_test is read-only. verify_jwt = false is NOT wanted here:
// this is an operator tool, called with the service role key.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { classifyNumber } from "./nanpa.ts";

const SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const basic = () => `Basic ${btoa(`${SID}:${TOKEN}`)}`;

async function tw(path: string, init?: RequestInit) {
  // Messaging Services live on messaging.twilio.com; everything else on api.twilio.com.
  const host = path.startsWith("/v1/Services") ? "https://messaging.twilio.com" : "https://api.twilio.com";
  const r = await fetch(path.startsWith("http") ? path : `${host}${path}`, {
    ...init,
    headers: { Authorization: basic(), ...(init?.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, body: j as any };
}

async function sb(path: string, init?: RequestInit) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_SR,
      Authorization: `Bearer ${SB_SR}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, body: j as any };
}

async function listServices() {
  const svc = await tw(`/v1/Services?PageSize=50`);
  if (!svc.ok) return { error: svc.body, status: svc.status };
  const services = svc.body?.services ?? [];
  const out: any[] = [];
  for (const s of services) {
    const nums = await tw(`/v1/Services/${s.sid}/PhoneNumbers?PageSize=100`);
    out.push({
      sid: s.sid,
      friendly_name: s.friendly_name,
      inbound_request_url: s.inbound_request_url,
      inbound_method: s.inbound_method,
      fallback_url: s.fallback_url,
      // When false, the SERVICE url wins over the number-level sms_url.
      use_inbound_webhook_on_number: s.use_inbound_webhook_on_number,
      status_callback: s.status_callback,
      smart_encoding: s.smart_encoding,
      pool: (nums.body?.phone_numbers ?? []).map((p: any) => ({
        sid: p.sid,
        phone_number: p.phone_number,
        capabilities: p.capabilities,
      })),
    });
  }
  return { count: out.length, services: out };
}

async function listNumbers() {
  const all: any[] = [];
  let url = `/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PageSize=100`;
  while (url) {
    const r = await tw(url);
    if (!r.ok) return { error: r.body, fetched: all.length };
    all.push(...(r.body?.incoming_phone_numbers ?? []));
    url = r.body?.next_page_uri || "";
    if (all.length > 500) break;
  }
  const db = await sb(
    "dc_phone_numbers?select=phone_number,sms_webhook_url,twilio_sid,sid,business,status,is_active",
  );
  const dbMap = new Map<string, any>();
  for (const row of Array.isArray(db.body) ? db.body : []) {
    dbMap.set(String(row.phone_number || "").replace(/\D/g, "").slice(-10), row);
  }
  const rows = all.map((n) => {
    const key = String(n.phone_number || "").replace(/\D/g, "").slice(-10);
    const dbRow = dbMap.get(key);
    return {
      phone_number: n.phone_number,
      friendly_name: n.friendly_name,
      sid: n.sid,
      live_sms_url: n.sms_url || null,
      live_sms_method: n.sms_method || null,
      live_sms_application_sid: n.sms_application_sid || null,
      live_sms_fallback_url: n.sms_fallback_url || null,
      live_voice_url: n.voice_url || null,
      in_db: !!dbRow,
      db_sms_webhook_url: dbRow?.sms_webhook_url ?? null,
      drift: !!dbRow && (dbRow.sms_webhook_url || null) !== (n.sms_url || null),
    };
  });
  return {
    total_live_numbers: rows.length,
    in_db: rows.filter((r) => r.in_db).length,
    missing_from_db: rows.filter((r) => !r.in_db).map((r) => r.phone_number),
    drifted: rows.filter((r) => r.drift).length,
    numbers: rows,
  };
}

async function backfill() {
  const live = await listNumbers();
  const updates: any[] = [];
  for (const n of (live as any).numbers ?? []) {
    if (!n.in_db) continue;
    if (!n.drift) continue;
    const r = await sb(
      `dc_phone_numbers?phone_number=eq.${encodeURIComponent(n.phone_number)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          sms_webhook_url: n.live_sms_url,
          twilio_webhook_configured: !!n.live_sms_url,
          twilio_webhook_configured_at: new Date().toISOString(),
        }),
      },
    );
    updates.push({ phone_number: n.phone_number, sms_webhook_url: n.live_sms_url, status: r.status });
  }
  return { updated: updates.length, updates, missing_from_db: (live as any).missing_from_db };
}

async function snapshot() {
  const q = async (p: string) => {
    const r = await fetch(`${SB_URL}/rest/v1/${p}`, {
      headers: {
        apikey: SB_SR,
        Authorization: `Bearer ${SB_SR}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    return r.headers.get("content-range")?.split("/")?.[1] ?? "?";
  };
  return {
    at: new Date().toISOString(),
    dnc_list: await q("dnc_list?select=id"),
    opt_out_events: await q("opt_out_events?select=id"),
    store_contacts_opted_out: await q("store_contacts?select=id&opted_out=is.true"),
  };
}

// READ-ONLY: full config + recent message traffic for a single number.
async function numberProbe(numberRaw: string, days = 90) {
  const number = numberRaw.startsWith("+") ? numberRaw : `+${numberRaw.replace(/\D/g, "")}`;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const cfg = await tw(
    `/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`,
  );
  const n = (cfg.body?.incoming_phone_numbers ?? [])[0] ?? null;

  const grab = async (dir: "To" | "From") => {
    const r = await tw(
      `/2010-04-01/Accounts/${SID}/Messages.json?${dir}=${encodeURIComponent(number)}&DateSent%3E=${since}&PageSize=50`,
    );
    return (r.body?.messages ?? []).map((m: any) => ({
      sid: m.sid,
      direction: m.direction,
      from: m.from,
      to: m.to,
      status: m.status,
      error_code: m.error_code,
      date_sent: m.date_sent,
      num_segments: m.num_segments,
      body_preview: String(m.body || "").slice(0, 60),
    }));
  };
  const calls = await tw(
    `/2010-04-01/Accounts/${SID}/Calls.json?StartTime%3E=${since}&PageSize=50`,
  );

  return {
    number,
    since,
    config: n && {
      sid: n.sid,
      friendly_name: n.friendly_name,
      date_created: n.date_created,
      account_sid: n.account_sid,
      sms_url: n.sms_url,
      sms_method: n.sms_method,
      sms_fallback_url: n.sms_fallback_url,
      status_callback: n.status_callback,
      voice_url: n.voice_url,
      voice_application_sid: n.voice_application_sid,
      sms_application_sid: n.sms_application_sid,
      bundle_sid: n.bundle_sid,
      trunk_sid: n.trunk_sid,
      emergency_status: n.emergency_status,
      capabilities: n.capabilities,
    },
    inbound_to_number: await grab("To"),
    outbound_from_number: await grab("From"),
    calls_involving_number: (calls.body?.calls ?? [])
      .filter((c: any) => c.to === number || c.from === number)
      .map((c: any) => ({ sid: c.sid, from: c.from, to: c.to, status: c.status, start_time: c.start_time })),
  };
}

// READ-ONLY: which Messaging Service (if any) owns a number, and subaccount list.
async function ownership(numberRaw: string) {
  const number = numberRaw.startsWith("+") ? numberRaw : `+${numberRaw.replace(/\D/g, "")}`;
  const svc = await tw(`/v1/Services?PageSize=50`);
  const hits: any[] = [];
  for (const s of svc.body?.services ?? []) {
    const nums = await tw(`/v1/Services/${s.sid}/PhoneNumbers?PageSize=100`);
    if ((nums.body?.phone_numbers ?? []).some((p: any) => p.phone_number === number)) {
      hits.push({
        sid: s.sid,
        friendly_name: s.friendly_name,
        inbound_request_url: s.inbound_request_url,
        use_inbound_webhook_on_number: s.use_inbound_webhook_on_number,
      });
    }
  }
  const subs = await tw(`/2010-04-01/Accounts.json?PageSize=50`);
  return {
    number,
    messaging_services: hits,
    accounts: (subs.body?.accounts ?? []).map((a: any) => ({
      sid: a.sid,
      friendly_name: a.friendly_name,
      status: a.status,
      date_created: a.date_created,
      is_main: a.sid === SID,
    })),
  };
}

const OURS = "qalaaroashbggynpvqct";

function projectRef(u?: string | null): string | null {
  if (!u) return null;
  const m = String(u).match(/https?:\/\/([a-z0-9]{20})\.supabase\.co/i) ||
    String(u).match(/https?:\/\/([a-z0-9-]+)\./i);
  return m ? m[1] : null;
}

// READ-ONLY: every number on the main account + every subaccount, classified by
// which Supabase project its sms/voice/status webhooks point at.
async function foreignScan() {
  const accountsRes = await tw(`/2010-04-01/Accounts.json?PageSize=50`);
  const accounts = (accountsRes.body?.accounts ?? []).map((a: any) => ({
    sid: a.sid,
    friendly_name: a.friendly_name,
    status: a.status,
    is_main: a.sid === SID,
  }));

  const rows: any[] = [];
  for (const acct of accounts) {
    let url = `/2010-04-01/Accounts/${acct.sid}/IncomingPhoneNumbers.json?PageSize=100`;
    let guard = 0;
    while (url && guard++ < 10) {
      const r = await tw(url);
      if (!r.ok) {
        rows.push({ account_sid: acct.sid, error: r.body });
        break;
      }
      for (const n of r.body?.incoming_phone_numbers ?? []) {
        const refs = {
          sms: projectRef(n.sms_url),
          voice: projectRef(n.voice_url),
          status: projectRef(n.status_callback),
        };
        const foreign = Object.values(refs).filter((x) => x && x !== OURS) as string[];
        rows.push({
          account_sid: acct.sid,
          account_name: acct.friendly_name,
          is_main_account: acct.is_main,
          phone_number: n.phone_number,
          sid: n.sid,
          date_created: n.date_created,
          sms_url: n.sms_url || null,
          voice_url: n.voice_url || null,
          status_callback: n.status_callback || null,
          refs,
          foreign_refs: [...new Set(foreign)],
          is_foreign: foreign.length > 0,
        });
      }
      url = r.body?.next_page_uri || "";
    }
  }

  const foreignRows = rows.filter((r) => r.is_foreign);
  const byRef: Record<string, string[]> = {};
  for (const r of foreignRows) {
    for (const ref of r.foreign_refs) (byRef[ref] ||= []).push(r.phone_number);
  }
  return {
    accounts,
    total_numbers: rows.length,
    foreign_count: foreignRows.length,
    foreign_numbers_by_project: byRef,
    foreign_numbers: foreignRows,
    all_numbers: rows,
  };
}

// READ-ONLY: billed cost + recordings for calls touching a number.
async function callCost(numberRaw: string, days = 120) {
  const number = numberRaw.startsWith("+") ? numberRaw : `+${numberRaw.replace(/\D/g, "")}`;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const calls: any[] = [];
  for (const dir of ["To", "From"] as const) {
    let url =
      `/2010-04-01/Accounts/${SID}/Calls.json?${dir}=${encodeURIComponent(number)}&StartTime%3E=${since}&PageSize=100`;
    let guard = 0;
    while (url && guard++ < 10) {
      const r = await tw(url);
      if (!r.ok) break;
      calls.push(...(r.body?.calls ?? []));
      url = r.body?.next_page_uri || "";
    }
  }
  const seen = new Set<string>();
  const uniq = calls.filter((c) => (seen.has(c.sid) ? false : (seen.add(c.sid), true)));
  const totalPrice = uniq.reduce((s, c) => s + Math.abs(Number(c.price || 0)), 0);
  const totalSeconds = uniq.reduce((s, c) => s + Number(c.duration || 0), 0);

  const recRes = await tw(
    `/2010-04-01/Accounts/${SID}/Recordings.json?DateCreated%3E=${since}&PageSize=100`,
  );
  const callSids = new Set(uniq.map((c) => c.sid));
  const recordings = (recRes.body?.recordings ?? [])
    .filter((r: any) => callSids.has(r.call_sid))
    .map((r: any) => ({
      sid: r.sid,
      call_sid: r.call_sid,
      duration: r.duration,
      channels: r.channels,
      price: r.price,
      date_created: r.date_created,
      status: r.status,
    }));

  return {
    number,
    since,
    call_count: uniq.length,
    total_billed_usd: Number(totalPrice.toFixed(4)),
    total_duration_seconds: totalSeconds,
    recordings_on_our_account: recordings.length,
    recordings,
    calls: uniq.map((c) => ({
      sid: c.sid,
      from: c.from,
      to: c.to,
      direction: c.direction,
      status: c.status,
      start_time: c.start_time,
      duration: c.duration,
      price: c.price,
      price_unit: c.price_unit,
    })),
  };
}

// READ-ONLY: full recording inventory for calls touching a number, with the
// legs of each parent call and a jurisdiction/consent classification.
async function recordingsAudit(numberRaw: string, days = 120) {
  const number = numberRaw.startsWith("+") ? numberRaw : `+${numberRaw.replace(/\D/g, "")}`;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // 1. every call leg touching the number
  const calls: any[] = [];
  for (const dir of ["To", "From"] as const) {
    let url =
      `/2010-04-01/Accounts/${SID}/Calls.json?${dir}=${encodeURIComponent(number)}&StartTime%3E=${since}&PageSize=100`;
    let guard = 0;
    while (url && guard++ < 10) {
      const r = await tw(url);
      if (!r.ok) break;
      calls.push(...(r.body?.calls ?? []));
      url = r.body?.next_page_uri || "";
    }
  }
  const callById = new Map<string, any>();
  for (const c of calls) callById.set(c.sid, c);

  // 2. every recording on the account in the window, keep those whose call we know
  const recs: any[] = [];
  let rurl = `/2010-04-01/Accounts/${SID}/Recordings.json?DateCreated%3E=${since}&PageSize=100`;
  let guard = 0;
  while (rurl && guard++ < 20) {
    const r = await tw(rurl);
    if (!r.ok) break;
    recs.push(...(r.body?.recordings ?? []));
    rurl = r.body?.next_page_uri || "";
  }
  const mine = recs.filter((r) => callById.has(r.call_sid));

  const rows = mine.map((r) => {
    const c = callById.get(r.call_sid) || {};
    const to = classifyNumber(c.to);
    const from = classifyNumber(c.from);
    return {
      recording_sid: r.sid,
      call_sid: r.call_sid,
      date_created: r.date_created,
      duration_seconds: Number(r.duration || 0),
      channels: Number(r.channels || 1),
      dual_channel: Number(r.channels || 1) === 2,
      source: r.source,
      status: r.status,
      price: r.price,
      call: {
        from: c.from,
        to: c.to,
        direction: c.direction,
        start_time: c.start_time,
        call_duration: c.duration,
        status: c.status,
      },
      called_party: { number: c.to, npa: to.npa, state: to.state, consent_regime: to.consent },
      calling_party: { number: c.from, npa: from.npa, state: from.state, consent_regime: from.consent },
      // Exposure = a recorded call whose called party sits in an all-party state.
      exposure: to.consent === "all_party"
        ? "all_party_state"
        : to.consent === "conditional"
        ? "conditional_state"
        : to.consent === "n/a"
        ? "toll_free_no_state"
        : to.consent,
      media_url: `https://api.twilio.com/2010-04-01/Accounts/${SID}/Recordings/${r.sid}.mp3`,
      deletable_by_us: true, // owned by our account SID; DELETE is available on the REST resource
    };
  });

  const byExposure: Record<string, number> = {};
  for (const r of rows) byExposure[r.exposure] = (byExposure[r.exposure] || 0) + 1;

  return {
    number,
    since,
    recording_count: rows.length,
    dual_channel_count: rows.filter((r) => r.dual_channel).length,
    total_recorded_seconds: rows.reduce((s, r) => s + r.duration_seconds, 0),
    exposure_summary: byExposure,
    all_party_recordings: rows.filter((r) => r.exposure === "all_party_state"),
    recordings: rows,
  };
}

// WRITE (destructive, explicit): delete named recordings from OUR Twilio account.
// Requires { sids: [...], confirm: "DELETE" }. Never deletes by wildcard.
async function deleteRecordings(payload: any) {
  const sids: string[] = Array.isArray(payload.sids) ? payload.sids.map(String) : [];
  if (payload.confirm !== "DELETE") return { error: 'confirm must be exactly "DELETE"' };
  if (!sids.length || sids.some((s) => !/^RE[0-9a-f]{32}$/i.test(s))) {
    return { error: "sids must be a non-empty array of RE... recording SIDs" };
  }
  const results: any[] = [];
  for (const sid of sids) {
    const r = await tw(`/2010-04-01/Accounts/${SID}/Recordings/${sid}.json`, { method: "DELETE" });
    results.push({ sid, ok: r.status === 204 || r.ok, status: r.status, error: r.status === 204 ? null : r.body });
  }
  return { deleted: results.filter((r) => r.ok).length, attempted: results.length, results };
}

// READ-ONLY: what would break if VoiceUrl changed. Who actually dials this
// number, and is the traffic self-originated (the loop) or external?
async function voiceImpact(numberRaw: string, days = 120) {
  const number = numberRaw.startsWith("+") ? numberRaw : `+${numberRaw.replace(/\D/g, "")}`;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const cfg = await tw(
    `/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`,
  );
  const n = (cfg.body?.incoming_phone_numbers ?? [])[0] || null;

  const calls: any[] = [];
  for (const dir of ["To", "From"] as const) {
    let url =
      `/2010-04-01/Accounts/${SID}/Calls.json?${dir}=${encodeURIComponent(number)}&StartTime%3E=${since}&PageSize=100`;
    let guard = 0;
    while (url && guard++ < 10) {
      const r = await tw(url);
      if (!r.ok) break;
      calls.push(...(r.body?.calls ?? []));
      url = r.body?.next_page_uri || "";
    }
  }
  const seen = new Set<string>();
  const uniq = calls.filter((c) => (seen.has(c.sid) ? false : (seen.add(c.sid), true)));

  const selfLegs = uniq.filter((c) => c.from === number && c.to === number);
  const inboundExternal = uniq.filter((c) => c.to === number && c.from !== number);
  const outboundExternal = uniq.filter((c) => c.from === number && c.to !== number);

  const externalCallers: Record<string, number> = {};
  for (const c of inboundExternal) externalCallers[c.from] = (externalCallers[c.from] || 0) + 1;

  return {
    number,
    since,
    current_config: n
      ? {
        sid: n.sid,
        voice_url: n.voice_url,
        voice_method: n.voice_method,
        voice_fallback_url: n.voice_fallback_url,
        status_callback: n.status_callback,
        voice_application_sid: n.voice_application_sid,
        trunk_sid: n.trunk_sid,
        sms_url: n.sms_url,
      }
      : null,
    total_call_legs: uniq.length,
    self_dial_legs: selfLegs.length,
    inbound_external_legs: inboundExternal.length,
    outbound_external_legs: outboundExternal.length,
    distinct_external_callers: Object.keys(externalCallers).length,
    external_callers: externalCallers,
    external_call_samples: inboundExternal.slice(0, 20).map((c) => ({
      sid: c.sid,
      from: c.from,
      start_time: c.start_time,
      duration: c.duration,
      status: c.status,
    })),
  };
}


// WRITE (SMS ONLY): repoint a number's SmsUrl. Voice is never touched here.
async function repointSms(payload: any) {
  const number = String(payload.number || "");
  const target = String(payload.sms_url || "");
  if (!number.startsWith("+") || !target.startsWith("https://")) {
    return { error: "number (E.164) and sms_url (https) are required" };
  }
  const cfg = await tw(
    `/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`,
  );
  const n = (cfg.body?.incoming_phone_numbers ?? [])[0];
  if (!n) return { error: "number not found on main account" };
  const before = { sms_url: n.sms_url, sms_method: n.sms_method, voice_url: n.voice_url };
  const upd = await tw(`/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers/${n.sid}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ SmsUrl: target, SmsMethod: "POST" }).toString(),
  });
  return {
    number,
    before,
    after: upd.ok
      ? { sms_url: upd.body?.sms_url, sms_method: upd.body?.sms_method, voice_url: upd.body?.voice_url }
      : null,
    ok: upd.ok,
    status: upd.status,
    error: upd.ok ? null : upd.body,
  };
}

// WRITE (VOICE ONLY): repoint a number's VoiceUrl. StatusCallback, SmsUrl and
// every other field are left exactly as-is. Guarded by confirm:"REPOINT_VOICE".
// Includes a recursion pre-check: if our own handler would end up dialling the
// SAME number back (directory row or global env DID pointing at itself), we
// refuse — that would reproduce the loop under a different roof.
async function repointVoice(payload: any) {
  const number = String(payload.number || "");
  const target = String(payload.voice_url || "");
  if (payload.confirm !== "REPOINT_VOICE") return { error: 'confirm must be exactly "REPOINT_VOICE"' };
  if (!number.startsWith("+") || !target.startsWith("https://")) {
    return { error: "number (E.164) and voice_url (https) are required" };
  }

  const read = async () => {
    const cfg = await tw(
      `/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`,
    );
    const n = (cfg.body?.incoming_phone_numbers ?? [])[0];
    if (!n) return null;
    return {
      sid: n.sid,
      voice_url: n.voice_url,
      voice_method: n.voice_method,
      voice_fallback_url: n.voice_fallback_url,
      voice_application_sid: n.voice_application_sid,
      trunk_sid: n.trunk_sid,
      status_callback: n.status_callback,
      status_callback_method: n.status_callback_method,
      sms_url: n.sms_url,
      sms_method: n.sms_method,
    };
  };

  const before = await read();
  if (!before) return { error: "number not found on main account" };

  // Recursion pre-check against our own handler's resolution order.
  const last10 = number.replace(/\D/g, "").slice(-10);
  const dirRes = await sb(
    `v_phone_directory?select=phone_e164,business,assigned_agent_id,is_active&is_active=eq.true&phone_e164=ilike.*${last10}&limit=1`,
  );
  const dirRow = Array.isArray(dirRes.body) ? (dirRes.body[0] || null) : null;
  const globalDid = Deno.env.get("BLAND_INBOUND_NUMBER") || "";
  const resolvedDid = dirRow?.assigned_agent_id || globalDid || "";
  const wouldSelfDial = !!resolvedDid && resolvedDid.replace(/\D/g, "").slice(-10) === last10;
  const precheck = {
    directory_row: dirRow ? { phone_e164: dirRow.phone_e164, business: dirRow.business, has_agent: !!dirRow.assigned_agent_id } : null,
    global_env_did_set: !!globalDid,
    resolved_did_matches_this_number: wouldSelfDial,
    outcome_if_no_did: "Say 'line is not yet configured' + Hangup (no Dial, no recursion)",
  };
  if (wouldSelfDial) {
    return { error: "refused: our handler would dial this same number back", precheck, before };
  }

  const upd = await tw(`/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers/${before.sid}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ VoiceUrl: target, VoiceMethod: "POST" }).toString(),
  });

  // Verify by RE-READING Twilio, not by trusting the write response.
  const after = await read();
  const untouched = before && after
    ? {
      status_callback: before.status_callback === after.status_callback,
      sms_url: before.sms_url === after.sms_url,
      voice_fallback_url: before.voice_fallback_url === after.voice_fallback_url,
      voice_application_sid: before.voice_application_sid === after.voice_application_sid,
      trunk_sid: before.trunk_sid === after.trunk_sid,
    }
    : null,
  ;
  return {
    number,
    precheck,
    before,
    after,
    write_status: upd.status,
    verified: after?.voice_url === target,
    unchanged_fields: untouched,
    error: upd.ok ? null : upd.body,
  };
}

async function stopTest(payload: any) {
  const to = payload.to || "+18776818621";
  const from = payload.from;
  if (!from) return { error: "from is required (must be an owned Twilio number)" };
  const r = await tw(`/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: payload.body || "STOP" }).toString(),
  });
  return { status: r.status, ok: r.ok, sid: r.body?.sid, error_code: r.body?.code, body: r.body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "numbers";
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (!SID || !TOKEN) return json({ error: "twilio credentials missing" }, 500);
  if (!SID.startsWith("AC")) return json({ error: "TWILIO_ACCOUNT_SID must start with AC" }, 500);

  try {
    const payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    switch (action) {
      case "services":
        return json(await listServices());
      case "numbers":
        return json(await listNumbers());
      case "backfill":
        return json(await backfill());
      case "number_probe":
        return json(
          await numberProbe(
            url.searchParams.get("number") || payload.number || "",
            Number(url.searchParams.get("days") || payload.days || 90),
          ),
        );
      case "ownership":
        return json(await ownership(url.searchParams.get("number") || payload.number || ""));
      case "foreign_scan":
        return json(await foreignScan());
      case "call_cost":
        return json(
          await callCost(
            url.searchParams.get("number") || payload.number || "",
            Number(url.searchParams.get("days") || payload.days || 120),
          ),
        );
      case "recordings":
        return json(
          await recordingsAudit(
            url.searchParams.get("number") || payload.number || "",
            Number(url.searchParams.get("days") || payload.days || 120),
          ),
        );
      case "voice_impact":
        return json(
          await voiceImpact(
            url.searchParams.get("number") || payload.number || "",
            Number(url.searchParams.get("days") || payload.days || 120),
          ),
        );
      case "delete_recordings":
        return json(await deleteRecordings(payload));
      case "repoint_sms":
        return json(await repointSms(payload));
      case "snapshot":
        return json(await snapshot());
      case "stop_test":
        return json({ snapshot_before: await snapshot(), send: await stopTest(payload) });
      default:
        return json({ error: `unknown action ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
