// DEPRECATED — this function is a thin forwarder into the canonical `send-sms`.
// Kept for backward compatibility with existing callers (BlandDialHubPage and
// bland-start-call). All real logic (opt-out checks, idempotency, A2P guard,
// provider fallback, logging) lives in send-sms.
//
// New code should call `send-sms` directly with `purpose: "bland_outreach"`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BRANDARO_SITE = "https://www.brandarodigital.com";
const DEFAULT_MESSAGE =
  `Hi! This is Brandaro Digital — we build high-converting websites and dominate Google for local businesses. Browse our portfolio: ${BRANDARO_SITE}\n\nReply STOP to opt out.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SRK);

    const body = await req.json().catch(() => ({} as any));
    const raw: unknown =
      body?.phone_numbers ?? (body?.phone_number ? [body.phone_number] : []);
    if (!Array.isArray(raw) || raw.length === 0) {
      return json(
        { error: "phone_numbers (array) or phone_number (string) is required" },
        400,
      );
    }
    const message: string =
      (body?.message && String(body.message).trim()) || DEFAULT_MESSAGE;
    const source: string = body?.source || "manual";
    const lead_id: string | null = body?.lead_id || null;

    const results: Array<{
      to: string;
      ok: boolean;
      sid?: string;
      error?: string;
    }> = [];

    for (const p of raw) {
      const num = String(p).trim();
      const to = num.startsWith("+") ? num : `+${num.replace(/[^0-9]/g, "")}`;
      if (!/^\+[1-9]\d{6,14}$/.test(to)) {
        results.push({ to: num, ok: false, error: "invalid E.164 number" });
        continue;
      }

      const idempotency_key = `bland-${to}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to_number: to,
          message_body: message,
          idempotency_key,
          explicit_provider: "twilio",
          purpose: "bland_outreach",
          metadata: { source, lead_id, forwarded_from: "bland-send-sms" },
        },
      });

      if (error) {
        results.push({ to, ok: false, error: error.message });
        continue;
      }
      const ok = (data as any)?.success === true;
      results.push({
        to,
        ok,
        sid: (data as any)?.provider_message_id ?? undefined,
        error: ok ? undefined : (data as any)?.reason ?? (data as any)?.error,
      });
    }

    const sent = results.filter((r) => r.ok).length;
    return json({ ok: true, sent, failed: results.length - sent, results });
  } catch (err) {
    console.error("bland-send-sms (forwarder) error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
