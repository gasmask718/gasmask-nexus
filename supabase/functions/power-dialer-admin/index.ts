// POWER DIALER ADMIN — the live-mode gate.
//
// telephony_mode / twilio_enabled are the two switches between "no real
// calls" and "real calls are placed". They are NEVER flipped by a cron,
// a trigger, or a settings save — only here, by an admin/owner, and only
// AFTER a successful test call proves the full path:
//
//   test_call   → places ONE real call to a number the admin types in.
//                 AsyncAmd verdict arrives at dialer-call-status exactly
//                 like a production power-dial call would.
//   confirm_test→ unlocks live mode ONLY if our own webhook pipeline
//                 recorded answered_by='human' for that test call (or the
//                 Twilio API reports it). Recorded in live_mode_unlocked_at.
//   set_simulation → back to safe mode; also disarms the engine.
//
// Until confirm_test succeeds, live mode stays locked — a dialer that
// looks live while simulating is worse than one obviously off.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── JWT + role gate: admin or owner only ──
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "auth_required" }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "invalid_token" }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: user.id, _role: "owner" });
    if (!isAdmin && !isOwner) return json({ error: "forbidden", detail: "admin or owner role required" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = (body.action || "status") as string;

    // Settings are effectively a singleton (arm_dialer updates the table
    // wholesale); resolve the row explicitly so writes are targeted.
    const { data: settings, error: sErr } = await supabase
      .from("dialer_settings").select("*").limit(1).maybeSingle();
    if (sErr || !settings) return json({ error: "no_dialer_settings", detail: sErr?.message }, 500);

    if (action === "status") {
      return json({
        ok: true,
        telephony_mode: settings.telephony_mode,
        twilio_enabled: settings.twilio_enabled,
        live_mode_unlocked_at: settings.live_mode_unlocked_at,
        live_mode_unlocked_by: settings.live_mode_unlocked_by,
        live_mode_test_call_sid: settings.live_mode_test_call_sid,
        engine_armed: settings.engine_armed,
        armed_campaign_id: settings.armed_campaign_id,
        auto_disarm_at: settings.auto_disarm_at,
      });
    }

    if (action === "test_call") {
      const phone = String(body.phone || "").replace(/[^\d+]/g, "");
      if (!/^\+?\d{10,15}$/.test(phone)) {
        return json({ error: "invalid_phone", detail: "Enter a full number with country code, e.g. +19295551234" }, 400);
      }
      const SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      if (!SID || !TOKEN) return json({ error: "twilio_env_missing" }, 500);

      // The test call presents the GasMask / Grabba default caller ID —
      // +19298225712, the one human voice line in the pool — resolved from
      // the database, not a shared env var. Env is the fallback only.
      let FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
      const { data: gm } = await supabase
        .from("va_companies").select("id").eq("slug", "gasmask_grabba").maybeSingle();
      if (gm?.id) {
        const { data: num } = await supabase
          .from("dc_phone_numbers")
          .select("phone_number")
          .eq("va_company_id", gm.id)
          .eq("is_default_caller_id", true)
          .eq("is_active", true)
          .maybeSingle();
        if (num?.phone_number) FROM = num.phone_number;
      }
      if (!FROM) return json({ error: "no_caller_id", detail: "No GasMask/Grabba default caller ID and no TWILIO_PHONE_NUMBER fallback." }, 500);

      const cb = new URLSearchParams({ purpose: "live_mode_test" });
      const params = new URLSearchParams({
        To: phone.startsWith("+") ? phone : `+${phone}`,
        From: FROM,
        Url: `${SUPABASE_URL}/functions/v1/power-dial-twiml?${cb.toString()}`,
        Method: "POST",
        StatusCallback: `${SUPABASE_URL}/functions/v1/dialer-call-status?${cb.toString()}`,
        StatusCallbackMethod: "POST",
        Timeout: "30",
        AsyncAmd: "true",
        AsyncAmdStatusCallback: `${SUPABASE_URL}/functions/v1/dialer-call-status?${cb.toString()}`,
        AsyncAmdStatusCallbackMethod: "POST",
        MachineDetectionTimeout: "5",
      });
      // Twilio subscribes to call-progress events ONLY when each event is its
      // own repeated StatusCallbackEvent parameter. A single space-joined
      // value is treated as one unrecognized event name and subscribes to
      // NOTHING — the silent-webhook bug found 2026-08-24.
      for (const ev of ["initiated", "ringing", "answered", "completed"]) {
        params.append("StatusCallbackEvent", ev);
      }

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`,
        { method: "POST", headers: { Authorization: "Basic " + btoa(`${SID}:${TOKEN}`), "Content-Type": "application/x-www-form-urlencoded" }, body: params },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sid) {
        return json({ error: "twilio_call_failed", detail: data.message || res.status }, 502);
      }

      await supabase.from("dialer_settings").update({
        live_mode_test_call_sid: data.sid, updated_at: new Date().toISOString(),
      }).eq("id", settings.id);

      return json({
        ok: true, test_call_sid: data.sid, from: FROM,
        message: `Test call placed from ${FROM}. ANSWER IT and stay on the line — this screen watches each step and unlocks live mode when a human answer is confirmed.`,
      });
    }

    // Live progress for the test call, derived from OUR webhook pipeline's
    // own event log (dialer_call_events). The console polls this so each
    // step — dialing, ringing, answered, human confirmed — shows as it
    // happens, and a failure names the exact step that failed.
    if (action === "test_status") {
      const testSid = settings.live_mode_test_call_sid;
      if (!testSid) return json({ ok: true, testing: false });

      const { data: events } = await supabase
        .from("dialer_call_events")
        .select("event_type, payload, created_at")
        .eq("call_sid", testSid)
        .order("created_at", { ascending: true });
      const evs = (events || []) as any[];
      const has = (t: string) => evs.some((e) => e.event_type === t);
      const amd = [...evs].reverse().find((e) => e.event_type === "twilio.amd_result");
      const answeredBy: string | null = (amd?.payload as any)?.answered_by ?? null;
      const failEv = evs.find((e) =>
        ["twilio.failed", "twilio.busy", "twilio.canceled", "twilio.no-answer"].includes(e.event_type));

      // AMD "answered" implies the call was answered; ringing implies dialing.
      const steps = {
        dialing: evs.length > 0,
        ringing: has("twilio.ringing") || has("twilio.in-progress") || !!amd,
        answered: has("twilio.in-progress") || !!amd,
        human_confirmed: answeredBy === "human",
      };

      let failure: { step: string; detail: string } | null = null;
      if (failEv) {
        const p = (failEv.payload || {}) as any;
        const status = failEv.event_type.replace("twilio.", "");
        const step =
          status === "no-answer" ? "answered" :
          status === "busy" ? "ringing" : "dialing";
        failure = {
          step,
          detail: `Twilio reported '${status}'${p.error_code ? ` (error ${p.error_code})` : ""}${p.error_message ? `: ${p.error_message}` : ""}`,
        };
      } else if (answeredBy && answeredBy !== "human") {
        failure = { step: "human_confirmed", detail: `Answered by '${answeredBy}' — a machine or voicemail, not a human.` };
      }

      return json({
        ok: true,
        testing: true,
        sid: testSid,
        steps,
        answered_by: answeredBy,
        failure,
        unlocked_at: settings.live_mode_unlocked_at,
        telephony_mode: settings.telephony_mode,
        twilio_enabled: settings.twilio_enabled,
        events: evs.map((e) => ({
          t: e.event_type,
          at: e.created_at,
          status: (e.payload as any)?.call_status ?? null,
          answered_by: (e.payload as any)?.answered_by ?? null,
          err: (e.payload as any)?.error_message || (e.payload as any)?.error_code || null,
        })),
      });
    }

    if (action === "confirm_test") {
      const testSid = settings.live_mode_test_call_sid;
      if (!testSid) return json({ error: "no_test_call", detail: "Place a test call first." }, 400);

      // Primary proof: OUR OWN webhook pipeline recorded a human AMD verdict
      // for this call — that proves signing, callbacks and AMD all work.
      const { data: amdEvent } = await supabase
        .from("dialer_call_events")
        .select("id, payload")
        .eq("call_sid", testSid)
        .eq("event_type", "twilio.amd_result")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let answeredBy: string | null = (amdEvent?.payload as any)?.answered_by ?? null;

      // Fallback: ask Twilio directly (covers a delayed webhook).
      if (!answeredBy) {
        const SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
        if (SID && TOKEN) {
          const call = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls/${testSid}.json`,
            { headers: { Authorization: "Basic " + btoa(`${SID}:${TOKEN}`) } },
          ).then(r => r.json()).catch(() => null);
          answeredBy = call?.answered_by ?? null;
          if (!answeredBy && call && !["in-progress", "completed"].includes(call.status)) {
            return json({
              error: "test_not_answered",
              detail: `Test call status is '${call.status}'. Answer the test call, then confirm.`,
            }, 400);
          }
        }
      }

      if (answeredBy !== "human") {
        return json({
          error: "human_not_confirmed",
          detail: answeredBy
            ? `The test call was answered by '${answeredBy}', not a human. Live mode stays locked.`
            : "No answer detected yet. Answer the test call and wait a few seconds, then try again.",
          answered_by: answeredBy,
        }, 400);
      }

      await supabase.from("dialer_settings").update({
        telephony_mode: "live",
        twilio_enabled: true,
        live_mode_unlocked_at: new Date().toISOString(),
        live_mode_unlocked_by: user.id,
        updated_at: new Date().toISOString(),
      }).eq("id", settings.id);

      return json({
        ok: true, unlocked: true, answered_by: answeredBy,
        message: "Confirmed human answer on the test call. LIVE MODE UNLOCKED — real calls will be placed while the engine is armed.",
      });
    }

    if (action === "set_simulation") {
      await supabase.from("dialer_settings").update({
        telephony_mode: "simulation",
        twilio_enabled: false,
        engine_armed: false,
        armed_campaign_id: null,
        updated_at: new Date().toISOString(),
      }).eq("id", settings.id);
      return json({ ok: true, message: "Back to SIMULATION — no real calls. Engine disarmed." });
    }

    return json({ error: "unknown_action", action }, 400);
  } catch (err) {
    console.error("power-dialer-admin error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
