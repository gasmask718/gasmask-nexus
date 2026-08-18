// Recovery job: for va_call_logs rows that carry a recording but no lead_id,
// pull the counterparty (To) number from Twilio by call_sid and resolve its
// jurisdiction. Writes to_number / to_number_source / derived_state /
// jurisdiction_recovery_status back onto the row.
//
// Three outcomes per row, never two:
//   matched                  -> To number found AND jurisdiction resolved
//   no_call_at_twilio        -> Twilio has no call for that call_sid
//   matched_no_jurisdiction  -> To number found, but it maps to no lead/state
//
// Admin/service invocation only. Read against Twilio, write only to the
// recovery columns — it never touches recordings.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function twilioCreds(): { sid: string; token: string; used: string } | null {
  const candidates = [
    ["BRANDARO_TWILIO_ACCOUNT_SID", "BRANDARO_TWILIO_AUTH_TOKEN"],
    ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  ];
  for (const [s, t] of candidates) {
    const sv = (Deno.env.get(s) || "").trim();
    const tv = (Deno.env.get(t) || "").trim();
    if (sv.startsWith("AC") && tv) return { sid: sv, token: tv, used: s };
  }
  return null;
}

const isE164 = (v: string) => /^\+\d{7,}$/.test(v || "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const creds = twilioCreds();
  if (!creds) return json({ error: "no usable twilio creds (need AC-prefixed SID + token)" }, 500);
  const auth = `Basic ${btoa(`${creds.sid}:${creds.token}`)}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { /* empty body ok */ } }
  const dryRun = String(body.dry_run ?? url.searchParams.get("dry_run") ?? "") === "1";
  const limit = Number(body.limit ?? url.searchParams.get("limit") ?? 500);

  // Platform-owned numbers. On inbound calls the To side is ours, so the
  // counterparty is the From side — picking blindly would classify our own
  // toll-free as the callee.
  const owned = new Set<string>();
  const last10 = (v: string) => (v || "").replace(/\D/g, "").slice(-10);
  for (const t of ["dc_phone_numbers", "va_phone_numbers"]) {
    const { data } = await supabase.from(t).select("phone_number").limit(2000);
    for (const r of data ?? []) if (r?.phone_number) owned.add(last10(r.phone_number));
  }

  const { data: rows, error: rowsErr } = await supabase
    .from("va_call_logs")
    .select("id, call_sid, recording_sid, twilio_number, called_at, duration_seconds")
    .is("lead_id", null)
    .not("recording_url", "is", null)
    .is("jurisdiction_recovered_at", null)
    .limit(limit);

  if (rowsErr) return json({ error: rowsErr.message }, 500);

  const results: any[] = [];
  const BATCH = 5;

  for (let i = 0; i < (rows?.length ?? 0); i += BATCH) {
    const chunk = (rows ?? []).slice(i, i + BATCH);
    const out = await Promise.all(chunk.map(async (row: any) => {
      const base = {
        id: row.id,
        call_sid: row.call_sid,
        called_at: row.called_at,
        duration_seconds: row.duration_seconds,
      };

      if (!row.call_sid) {
        return { ...base, status: "no_call_at_twilio", detail: "row has no call_sid" };
      }

      // Fetch the parent call, with one retry (Twilio 429s under burst).
      let call: any = null;
      let httpStatus = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Calls/${row.call_sid}.json`,
          { headers: { Authorization: auth } },
        );
        httpStatus = r.status;
        if (r.ok) { call = await r.json(); break; }
        if (r.status === 404) break;
        await new Promise((res) => setTimeout(res, 400));
      }

      if (!call) {
        return {
          ...base,
          status: httpStatus === 404 ? "no_call_at_twilio" : "twilio_error",
          detail: `twilio http ${httpStatus}`,
        };
      }

      let to = String(call.to || "");
      let from = String(call.from || "");
      // Browser-SDK parent legs are client:<identity> on both sides; the real
      // counterparty lives on the child <Dial> leg.
      if (!isE164(to)) {
        const kr = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Calls.json?ParentCallSid=${row.call_sid}&PageSize=5`,
          { headers: { Authorization: auth } },
        );
        if (kr.ok) {
          const kj = await kr.json();
          const kid = (kj.calls || []).find((k: any) => isE164(String(k.to || "")));
          if (kid) { to = String(kid.to); from = String(kid.from || from); }
        }
      }
      // Pick the leg that isn't ours. On inbound calls the To side is a
      // platform-owned number and the counterparty is the From side.
      const cands = [to, from].filter(isE164);
      const counterparty = cands.find((c) => !owned.has(last10(c))) || "";

      if (!counterparty) {
        return { ...base, status: "matched_no_jurisdiction", to_number: null, detail: "twilio has the call but no E.164 counterparty on any leg" };
      }

      const { data: cons } = await supabase.rpc("resolve_recording_consent", {
        p_phone: counterparty.replace(/\D/g, ""),
      });
      const hit = Array.isArray(cons) ? cons[0] : cons;
      const state = hit?.state ?? null;
      const status = state ? "matched" : "matched_no_jurisdiction";

      if (!dryRun) {
        const { error: upErr } = await supabase
          .from("va_call_logs")
          .update({
            to_number: counterparty,
            to_number_source: "twilio_recovery",
            derived_state: state,
            jurisdiction_recovery_status: status,
            jurisdiction_recovered_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (upErr) console.error("[recovery] update failed", row.id, upErr.message);
      }

      return {
        ...base,
        status,
        to_number: counterparty,
        direction: call.direction || null,
        state,
        consent_rule: hit?.consent_rule ?? null,
        contested: hit?.contested ?? null,
        jurisdiction_source: hit?.source ?? null,
      };
    }));
    results.push(...out);
  }

  const tally: Record<string, number> = {};
  const byState: Record<string, number> = {};
  for (const r of results) {
    tally[r.status] = (tally[r.status] || 0) + 1;
    if (r.state) byState[r.state] = (byState[r.state] || 0) + 1;
  }

  return json({
    account: creds.sid,
    cred_used: creds.used,
    dry_run: dryRun,
    considered: results.length,
    outcomes: tally,
    by_state: byState,
    all_party: results.filter((r) => r.consent_rule === "all_party").length,
    rows: url.searchParams.get("summary") === "1" ? undefined : results,
  });
});
