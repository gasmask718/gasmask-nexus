import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CATEGORIES = [
  "smoke_shop",
  "smoke",
  "tobacco",
  "vape_tobacco",
  "tobacco_shop",
  "deli",
  "bodega",
];

const E164 = /^\+[1-9]\d{1,14}$/;

function normalize(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return (raw ?? "").trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Prefer the scoped API-key pair; fall back to the master SID/token.
    const apiSid = Deno.env.get("TWILIO_API_SID");
    const apiSecret = Deno.env.get("TWILIO_API_SECRET");
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");

    let authUser: string | undefined;
    let authPass: string | undefined;
    let authMode = "";
    if (apiSid && apiSecret) {
      authUser = apiSid; authPass = apiSecret; authMode = "api_key";
    } else if (sid && token) {
      authUser = sid; authPass = token; authMode = "master";
    }
    if (!authUser || !authPass) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const auth = "Basic " + btoa(`${authUser}:${authPass}`);

    let limit = 300;
    let testNumber: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.limit === "number" && body.limit > 0) {
        limit = Math.min(Math.floor(body.limit), 300);
      }
      if (body && typeof body.test_number === "string") testNumber = body.test_number;
    } catch (_) { /* no body */ }

    // Single-number auth probe: no DB reads or writes.
    if (testNumber) {
      const probe = normalize(testNumber);
      const res = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(probe)}?Fields=line_type_intelligence`,
        { headers: { Authorization: auth } },
      );
      const text = await res.text();
      return new Response(
        JSON.stringify({ mode: "test", auth_mode: authMode, number: probe, status: res.status, body: text.slice(0, 800) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const { data: rows, error: selErr } = await supabase
      .from("leads")
      .select("id, phone_e164")
      .eq("verify_status", "unverified")
      .not("phone_e164", "is", null)
      .in("category", CATEGORIES)
      .order("fit_score", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (selErr) {
      return new Response(JSON.stringify({ error: selErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let looked_up = 0, phone_live = 0, phone_dead = 0, skipped = 0, errors = 0;

    for (const row of rows ?? []) {
      const raw = (row.phone_e164 ?? "").trim();
      const phone = normalize(raw);

      // Store the normalized value back so the pool stays clean.
      if (phone && phone !== raw) {
        await supabase.from("leads").update({ phone_e164: phone }).eq("id", row.id);
      }

      if (!E164.test(phone)) {
        await supabase.from("leads").update({
          verify_status: "phone_dead",
          verified_at: new Date().toISOString(),
          verified_by: "twilio_lookup",
          verify_notes: "invalid E.164 format",
        }).eq("id", row.id);
        phone_dead++;
        skipped++;
        continue;
      }

      try {
        const res = await fetch(
          `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`,
          { headers: { Authorization: auth } },
        );

        if (res.status === 404) {
          await supabase.from("leads").update({
            verify_status: "phone_dead",
            verified_at: new Date().toISOString(),
            verified_by: "twilio_lookup",
            verify_notes: "twilio 404 not found",
          }).eq("id", row.id);
          looked_up++;
          phone_dead++;
          await sleep(150);
          continue;
        }

        if (!res.ok) {
          const body = await res.text();
          console.error(`Twilio lookup failed [${res.status}] ${phone}: ${body}`);
          errors++;
          await sleep(150);
          continue;
        }

        const data = await res.json();
        const lti = data?.line_type_intelligence ?? {};
        const lineType = lti?.type ? String(lti.type).toLowerCase() : null;
        const carrier = data?.carrier?.name ?? lti?.carrier_name ?? lti?.mobile_network_code ?? null;
        const dead = data?.valid === false || !carrier;

        await supabase.from("leads").update({
          line_type: lineType,
          carrier: carrier ? String(carrier) : null,
          verified_at: new Date().toISOString(),
          verified_by: "twilio_lookup",
          verify_status: dead ? "phone_dead" : "phone_live",
          verify_notes: null,
        }).eq("id", row.id);


        looked_up++;
        if (dead) phone_dead++; else phone_live++;
      } catch (e) {
        console.error(`Lookup exception ${phone}:`, e);
        errors++;
      }

      await sleep(150);
    }

    const { count: remaining } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("verify_status", "unverified")
      .not("phone_e164", "is", null)
      .in("category", CATEGORIES);

    return new Response(
      JSON.stringify({ limit, remaining: remaining ?? null, looked_up, phone_live, phone_dead, skipped, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("twilio-lookup fatal:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
