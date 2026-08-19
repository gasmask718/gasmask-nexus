// Diagnostic (Group B / test class): send one SMS from the GasMask 877
// toll-free number and poll its delivery status.
//
// This function used to be world-callable and sent to a hard-coded handset on
// every hit — an unauthenticated paid send. It is now admin-gated, the
// destination must be supplied by the caller, and the send goes through the
// shared module so the test leaves the same audit row as production traffic.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTwilioSms } from "../_shared/twilioSend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "+18776818621";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r: { role: string }) => ["admin", "owner"].includes(r.role))) {
      return json({ error: "forbidden" }, 403);
    }

    let payload: Record<string, unknown> = {};
    try { payload = await req.json(); } catch { /* empty body */ }
    const to = typeof payload.to === "string" ? payload.to.trim() : "";
    if (!to) return json({ error: "`to` is required (E.164 destination for the test)" }, 400);

    const sent = await sendTwilioSms({
      to,
      body: "TopTier outbound delivery test from GasMask 877. Reply not needed. Test ID: " +
        new Date().toISOString(),
      suppressionClass: "test",
      source: "tt-deliverability-test",
      from: FROM,
      metadata: { requested_by: user.id },
    });

    if (!sent.success || !sent.sid) {
      return json({
        phase: "create",
        ok: false,
        status: sent.status,
        error_code: sent.errorCode,
        error_message: sent.errorMessage,
      });
    }

    // Status polling is a read against Twilio, not a send.
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const auth = "Basic " + btoa(`${sid}:${token}`);
    let final: Record<string, unknown> = { status: sent.status };
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${sent.sid}.json`,
        { headers: { Authorization: auth } },
      );
      final = await r.json();
      if (["delivered", "undelivered", "failed"].includes(String(final.status))) break;
    }

    return json({
      ok: true,
      sid: sent.sid,
      initial_status: sent.status,
      final_status: final.status,
      error_code: final.error_code,
      error_message: final.error_message,
      from: final.from,
      to: final.to,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
