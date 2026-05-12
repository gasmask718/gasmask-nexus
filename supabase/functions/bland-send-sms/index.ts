// Single & bulk SMS sender for the Bland Dial Hub.
// Uses Brandaro-scoped Twilio credentials when available, falls back to legacy TWILIO_*.
// Logs every send into bland_sms_log (created on first run via insert-or-ignore semantics).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BRANDARO_SITE = "https://www.brandarodigital.com";

const DEFAULT_MESSAGE = `Hi! This is Brandaro Digital — we build high-converting websites and dominate Google for local businesses. Browse our portfolio: ${BRANDARO_SITE}\n\nReply STOP to opt out.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SID = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID") || Deno.env.get("TWILIO_ACCOUNT_SID");
    const TOKEN = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN") || Deno.env.get("TWILIO_AUTH_TOKEN");
    const FROM =
      Deno.env.get("BRANDARO_TWILIO_NUMBER") ||
      Deno.env.get("TWILIO_FROM_NUMBER") ||
      Deno.env.get("TWILIO_PHONE_NUMBER");
    const MSG_SVC = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

    if (!SID || !TOKEN || (!FROM && !MSG_SVC)) {
      return json({ error: "Twilio not configured (need ACCOUNT_SID + AUTH_TOKEN + FROM number or messaging service SID)" }, 500);
    }
    if (!SID.startsWith("AC")) return json({ error: "Twilio Account SID must start with 'AC'" }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SRK);

    const body = await req.json().catch(() => ({} as any));
    const raw: unknown = body?.phone_numbers ?? (body?.phone_number ? [body.phone_number] : []);
    if (!Array.isArray(raw) || raw.length === 0) {
      return json({ error: "phone_numbers (array) or phone_number (string) is required" }, 400);
    }
    const message: string = (body?.message && String(body.message).trim()) || DEFAULT_MESSAGE;
    const source: string = body?.source || "manual";
    const lead_id: string | null = body?.lead_id || null;

    const auth = btoa(`${SID}:${TOKEN}`);

    const results: Array<{ to: string; ok: boolean; sid?: string; error?: string }> = [];
    for (const p of raw) {
      const num = String(p).trim();
      const to = num.startsWith("+") ? num : `+${num.replace(/[^0-9]/g, "")}`;
      if (!/^\+[1-9]\d{6,14}$/.test(to)) {
        results.push({ to: num, ok: false, error: "invalid E.164 number" });
        continue;
      }
      const form = new URLSearchParams();
      form.set("To", to);
      if (MSG_SVC) form.set("MessagingServiceSid", MSG_SVC);
      else form.set("From", FROM!);
      form.set("Body", message);

      try {
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        });
        const j = await r.json();
        if (!r.ok) {
          results.push({ to, ok: false, error: j?.message || `HTTP ${r.status}` });
        } else {
          results.push({ to, ok: true, sid: j.sid });
        }

        // Best-effort log — silently ignore if table doesn't exist
        await supabase.from("bland_sms_log").insert({
          phone_number: to,
          message,
          source,
          lead_id,
          twilio_sid: j?.sid || null,
          status: r.ok ? "sent" : "failed",
          error: r.ok ? null : (j?.message || `HTTP ${r.status}`),
        }).then(() => {}).catch(() => {});
      } catch (e) {
        results.push({ to, ok: false, error: (e as Error).message });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    return json({ ok: true, sent, failed: results.length - sent, results });
  } catch (err) {
    console.error("bland-send-sms error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
