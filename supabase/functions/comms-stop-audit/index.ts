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
