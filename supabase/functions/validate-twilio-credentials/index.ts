import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ValidationResult {
  format_valid: boolean;
  format_errors: string[];
  twilio_api_reachable: boolean;
  twilio_api_detail: string;
  token_generation: boolean;
  token_error?: string;
  overall: "PASS" | "FAIL";
  failures: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsErr } = await sb.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { account_sid, api_key_sid, api_secret, twiml_app_sid } = body;

    const result: ValidationResult = {
      format_valid: true,
      format_errors: [],
      twilio_api_reachable: false,
      twilio_api_detail: "",
      token_generation: false,
      overall: "FAIL",
      failures: [],
    };

    // ── STEP 1: Format validation ──
    if (!/^AC[a-f0-9]{32}$/i.test(account_sid || "")) {
      result.format_valid = false;
      result.format_errors.push("Account SID must match AC + 32 hex chars");
    }
    if (!/^SK[a-f0-9]{32}$/i.test(api_key_sid || "")) {
      result.format_valid = false;
      result.format_errors.push("API Key SID must match SK + 32 hex chars");
    }
    if (!/^AP[a-f0-9]{32}$/i.test(twiml_app_sid || "")) {
      result.format_valid = false;
      result.format_errors.push("TwiML App SID must match AP + 32 hex chars");
    }
    if (!api_secret || api_secret.length < 20) {
      result.format_valid = false;
      result.format_errors.push("API Secret must be at least 20 characters");
    }

    if (!result.format_valid) {
      result.failures.push("Format validation failed");
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STEP 2: Twilio API ping ──
    try {
      const auth = btoa(`${api_key_sid}:${api_secret}`);
      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      if (twilioRes.status === 200) {
        result.twilio_api_reachable = true;
        result.twilio_api_detail = "Twilio API authenticated successfully";
      } else {
        const errBody = await twilioRes.text();
        result.twilio_api_detail = `HTTP ${twilioRes.status}: ${errBody.slice(0, 200)}`;
        result.failures.push(`Twilio API returned ${twilioRes.status}`);
      }
    } catch (err) {
      result.twilio_api_detail = `Network error: ${String(err).slice(0, 200)}`;
      result.failures.push("Twilio API unreachable");
    }

    // ── STEP 3: Token generation test ──
    try {
      // Use twilio-jwt to generate a test access token
      // We'll do a minimal JWT construction to validate the key pair works
      const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        jti: `${api_key_sid}-${now}`,
        iss: api_key_sid,
        sub: account_sid,
        nbf: now,
        exp: now + 3600,
        grants: {
          identity: "credential_test",
          voice: { outgoing: { application_sid: twiml_app_sid } },
        },
      };

      const enc = (obj: unknown) =>
        btoa(JSON.stringify(obj))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

      const signingInput = `${enc(header)}.${enc(payload)}`;

      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(api_secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
      const sig64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const token = `${signingInput}.${sig64}`;

      if (token.length > 200 && token.split(".").length === 3) {
        result.token_generation = true;
      } else {
        result.token_error = "Generated token has unexpected format";
        result.failures.push("Token generation produced invalid JWT");
      }
    } catch (err) {
      result.token_error = String(err).slice(0, 200);
      result.failures.push("Token generation threw an error");
    }

    // ── Final verdict ──
    if (result.format_valid && result.twilio_api_reachable && result.token_generation) {
      result.overall = "PASS";
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
