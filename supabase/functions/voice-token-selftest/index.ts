import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SID_PATTERNS: Record<string, RegExp> = {
  TWILIO_ACCOUNT_SID: /^AC[a-f0-9]{32}$/i,
  TWILIO_API_SID: /^SK[a-f0-9]{32}$/i,
  TWILIO_TWIML_APP_SID: /^AP[a-f0-9]{32}$/i,
};

function base64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlStr(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

serve(async (req: Request) => {
  console.log("FUNCTION ONLINE:", {
    name: "voice-token-selftest",
    project: Deno.env.get("SUPABASE_URL"),
    time: new Date().toISOString(),
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate all SIDs
    const validation: Record<string, { ok: boolean; detail: string }> = {};
    for (const [key, pattern] of Object.entries(SID_PATTERNS)) {
      const val = Deno.env.get(key);
      if (!val) {
        validation[key] = { ok: false, detail: "MISSING" };
      } else if (!pattern.test(val)) {
        validation[key] = { ok: false, detail: `Bad format: prefix '${val.substring(0, 2)}' (${val.length}ch)` };
      } else {
        validation[key] = { ok: true, detail: "OK" };
      }
    }

    const apiSecret = Deno.env.get("TWILIO_API_SECRET");
    if (!apiSecret || apiSecret.length < 20) {
      validation["TWILIO_API_SECRET"] = { ok: false, detail: apiSecret ? `Too short (${apiSecret.length}ch)` : "MISSING" };
    } else {
      validation["TWILIO_API_SECRET"] = { ok: true, detail: "OK" };
    }

    const allValid = Object.values(validation).every(v => v.ok);
    if (!allValid) {
      return new Response(JSON.stringify({
        ok: false,
        reason: "credential_validation_failed",
        validation,
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Generate a test token for audit_bot (never returned to client)
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const apiKeySid = Deno.env.get("TWILIO_API_SID")!;
    const apiKeySecret = Deno.env.get("TWILIO_API_SECRET")!;
    const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID")!;

    const now = Math.floor(Date.now() / 1000);
    const ttl = 3600;
    const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };
    const payload = {
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid,
      sub: accountSid,
      iat: now,
      nbf: now,
      exp: now + ttl,
      grants: {
        identity: "audit_bot",
        voice: { incoming: { allow: true }, outgoing: { application_sid: twimlAppSid } },
      },
    };

    const encodedHeader = base64urlStr(JSON.stringify(header));
    const encodedPayload = base64urlStr(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiKeySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
    const token = `${signingInput}.${base64url(new Uint8Array(signature))}`;

    if (token.length < 100) {
      return new Response(JSON.stringify({
        ok: false,
        reason: "token_generation_produced_short_result",
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    console.log("✅ Self-test token generated for audit_bot");

    return new Response(JSON.stringify({
      ok: true,
      identity: "audit_bot",
      expires_in: ttl,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Self-test error:", msg);
    return new Response(JSON.stringify({
      ok: false,
      reason: "token_generation_exception",
      error: msg,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
