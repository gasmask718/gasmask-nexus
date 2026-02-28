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

function mask(val: string | undefined): string {
  if (!val) return "MISSING";
  if (val.length <= 8) return `${val.substring(0, 2)}***`;
  return `${val.substring(0, 4)}…${val.slice(-4)} (${val.length}ch)`;
}

function base64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlStr(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function tryGenerateToken(
  accountSid: string,
  apiKeySid: string,
  apiKeySecret: string,
  twimlAppSid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };
    const payload = {
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid,
      sub: accountSid,
      iat: now,
      nbf: now,
      exp: now + 300,
      grants: {
        identity: "audit_test",
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
    return { success: token.length > 100 };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

serve(async (req: Request) => {
  console.log("FUNCTION ONLINE:", {
    name: "voice-pipeline-audit",
    project: Deno.env.get("SUPABASE_URL"),
    time: new Date().toISOString(),
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── STEP A: Environment Check ──
    const envKeys = [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_API_SID",
      "TWILIO_API_SECRET",
      "TWILIO_TWIML_APP_SID",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ];
    const env_health: Record<string, boolean> = {};
    const env_masked: Record<string, string> = {};
    for (const k of envKeys) {
      const v = Deno.env.get(k);
      env_health[k] = !!v && v.length > 5;
      env_masked[k] = mask(v);
    }

    // ── STEP B: SID Format Validation ──
    const sid_validation: Record<string, { valid: boolean; detail: string }> = {};
    for (const [key, pattern] of Object.entries(SID_PATTERNS)) {
      const val = Deno.env.get(key);
      if (!val) {
        sid_validation[key] = { valid: false, detail: "MISSING" };
      } else if (!pattern.test(val)) {
        sid_validation[key] = {
          valid: false,
          detail: `Expected ${pattern.toString()}, got prefix '${val.substring(0, 2)}' (${val.length}ch)`,
        };
      } else {
        sid_validation[key] = { valid: true, detail: `OK (${val.substring(0, 4)}…)` };
      }
    }
    const apiSecret = Deno.env.get("TWILIO_API_SECRET");
    sid_validation["TWILIO_API_SECRET"] = {
      valid: !!apiSecret && apiSecret.length >= 20,
      detail: apiSecret ? `${apiSecret.length} chars` : "MISSING",
    };

    const sids_ok = Object.values(sid_validation).every((v) => v.valid);

    // ── STEP C: Token Generation Test ──
    let token_generation: { success: boolean; error?: string } = { success: false, error: "Skipped — SID validation failed" };
    if (sids_ok) {
      token_generation = await tryGenerateToken(
        Deno.env.get("TWILIO_ACCOUNT_SID")!,
        Deno.env.get("TWILIO_API_SID")!,
        Deno.env.get("TWILIO_API_SECRET")!,
        Deno.env.get("TWILIO_TWIML_APP_SID")!,
      );
    }

    // ── STEP D: Function Self-Reachability ──
    // Use voice-token-selftest instead of calling twilio-voice-token directly
    // (which requires a user JWT and would always fail from server context)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const function_reachability: Record<string, { status: string; code: number | null; detail: string }> = {};

    // Test voice-token via the selftest endpoint (no user JWT needed)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/voice-token-selftest`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const code = res.status;
      if (code === 404) {
        function_reachability["twilio-voice-token"] = { status: "NOT_DEPLOYED", code, detail: "selftest function not deployed" };
      } else {
        try {
          const body = await res.json();
          if (body?.ok === true) {
            function_reachability["twilio-voice-token"] = { status: "OK", code, detail: `Selftest passed (identity: ${body.identity})` };
          } else {
            function_reachability["twilio-voice-token"] = { status: "SELFTEST_FAIL", code, detail: body?.reason || "selftest returned ok=false" };
          }
        } catch {
          function_reachability["twilio-voice-token"] = { status: "RUNTIME_ERROR", code, detail: `HTTP ${code} (non-JSON response)` };
        }
      }
    } catch (err) {
      function_reachability["twilio-voice-token"] = {
        status: "UNREACHABLE", code: null,
        detail: err instanceof Error ? err.message : String(err),
      };
    }

    // Test outbound-call directly (it handles service-role auth)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/twilio-outbound-call`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const code = res.status;
      let detail = `HTTP ${code}`;
      try {
        const body = await res.json();
        detail = `HTTP ${code}: ${body?.error || body?.code || "OK"}`;
      } catch { await res.text(); }

      if (code === 404) {
        function_reachability["twilio-outbound-call"] = { status: "NOT_DEPLOYED", code, detail };
      } else if (code >= 500) {
        function_reachability["twilio-outbound-call"] = { status: "RUNTIME_ERROR", code, detail };
      } else {
        // Any non-404 response (including 400/401 for missing params) means it's deployed & reachable
        function_reachability["twilio-outbound-call"] = { status: "OK", code, detail };
      }
    } catch (err) {
      function_reachability["twilio-outbound-call"] = {
        status: "UNREACHABLE", code: null,
        detail: err instanceof Error ? err.message : String(err),
      };
    }

    // ── STEP E: Twilio API Ping ──
    // Use Account SID + Auth Token for Accounts API (API Keys can't always read /Accounts)
    // Fall back to API Key Basic Auth if Auth Token unavailable
    let twilio_api_reachable = false;
    let twilio_api_detail = "Skipped";
    if (sids_ok) {
      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
      const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const apiSid = Deno.env.get("TWILIO_API_SID")!;
      const apiSecretVal = Deno.env.get("TWILIO_API_SECRET")!;

      // Prefer Account SID + Auth Token (full access), fall back to API Key
      const authPair = authToken && authToken.length >= 20
        ? `${accountSid}:${authToken}`
        : `${apiSid}:${apiSecretVal}`;

      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
          { headers: { "Authorization": "Basic " + btoa(authPair) } },
        );
        twilio_api_reachable = res.status === 200;
        twilio_api_detail = `HTTP ${res.status}`;
        if (res.status === 401) {
          const usedMethod = authPair.startsWith("AC") ? "AccountSID+AuthToken" : "APIKey+Secret";
          console.log(`Twilio 401 with ${usedMethod}. AC prefix: ${accountSid.substring(0, 4)}, Key prefix: ${apiSid.substring(0, 4)}`);
          twilio_api_detail = `HTTP 401 (auth: ${usedMethod})`;
        }
        await res.text();
      } catch (err) {
        twilio_api_detail = err instanceof Error ? err.message : String(err);
      }
    }

    // ── STEP F: Final Health Score ──
    const failures: string[] = [];
    const recommendations: string[] = [];

    if (!Object.values(env_health).every(Boolean)) {
      failures.push("Missing environment secrets");
      recommendations.push("Add missing secrets in Lovable Cloud settings");
    }
    if (!sids_ok) {
      const bad = Object.entries(sid_validation).filter(([, v]) => !v.valid).map(([k]) => k);
      failures.push(`Invalid SIDs: ${bad.join(", ")}`);
      recommendations.push("Replace invalid secrets with correct format (AC/SK/AP prefix, 34 chars)");
    }
    if (!token_generation.success) {
      failures.push(`Token generation failed: ${token_generation.error}`);
      recommendations.push("Verify TWILIO_API_SID and TWILIO_API_SECRET match an active API Key in Twilio Console");
    }
    for (const [name, r] of Object.entries(function_reachability)) {
      if (r.status !== "OK") {
        failures.push(`${name}: ${r.status} (${r.detail})`);
        if (r.status === "NOT_DEPLOYED") {
          recommendations.push(`Edge function '${name}' not deployed. Redeploy via Lovable.`);
        } else if (r.status === "SELFTEST_FAIL") {
          recommendations.push(`${name}: Token self-test failed — check TWILIO_API_SID and TWILIO_API_SECRET match an active API Key.`);
        } else {
          recommendations.push(`${name}: ${r.detail} — check function logs.`);
        }
      }
    }
    if (!twilio_api_reachable) {
      failures.push(`Twilio API: ${twilio_api_detail}`);
      recommendations.push(
        twilio_api_detail.includes("401")
          ? "API Key/Secret mismatch OR key belongs to a different account/subaccount. Create a new Standard API Key under the same account in Twilio Console, then update TWILIO_API_SID and TWILIO_API_SECRET secrets. Alternatively, add TWILIO_AUTH_TOKEN secret for full account-level access."
          : "Verify Twilio API connectivity and API Key permissions in Twilio Console"
      );
    }

    const total_checks = 5;
    const passed = [
      Object.values(env_health).every(Boolean),
      sids_ok,
      token_generation.success,
      Object.values(function_reachability).every((r) => r.status === "OK"),
      twilio_api_reachable,
    ].filter(Boolean).length;

    const health_score = Math.round((passed / total_checks) * 100);

    const result = {
      gate_d_status: failures.length === 0 ? "PASS" : "FAIL",
      health_score,
      steps: {
        a_environment: { env_health, env_masked },
        b_sid_validation: sid_validation,
        c_token_generation: token_generation,
        d_function_reachability: function_reachability,
        e_twilio_api: { reachable: twilio_api_reachable, detail: twilio_api_detail },
      },
      failures,
      recommendations,
      timestamp: new Date().toISOString(),
    };

    console.log("Audit result:", JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Audit error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
