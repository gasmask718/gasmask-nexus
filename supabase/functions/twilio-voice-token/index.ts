import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

async function createTwilioAccessToken(
  accountSid: string,
  apiKeySid: string,
  apiKeySecret: string,
  identity: string,
  twimlAppSid: string,
  ttl = 3600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };

  const grants: Record<string, unknown> = {
    identity,
    voice: {
      incoming: { allow: true },
      outgoing: { application_sid: twimlAppSid },
    },
  };

  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    nbf: now,
    exp: now + ttl,
    grants,
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

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

/** Mask a credential for safe logging: show prefix + last 4 chars */
function mask(val: string | undefined): string {
  if (!val) return "MISSING";
  if (val.length <= 8) return `${val.substring(0, 2)}***`;
  return `${val.substring(0, 4)}...${val.slice(-4)} (${val.length} chars)`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_API_SID = Deno.env.get("TWILIO_API_SID");
    const TWILIO_API_SECRET = Deno.env.get("TWILIO_API_SECRET");
    const TWILIO_TWIML_APP_SID = Deno.env.get("TWILIO_TWIML_APP_SID");

    // Diagnostic logging — shows masked prefixes to identify wrong credentials
    console.log("🔑 Twilio credential check:", {
      ACCOUNT_SID: mask(TWILIO_ACCOUNT_SID),
      API_SID: mask(TWILIO_API_SID),
      API_SECRET: mask(TWILIO_API_SECRET),
      TWIML_APP_SID: mask(TWILIO_TWIML_APP_SID),
      account_sid_valid: TWILIO_ACCOUNT_SID?.startsWith("AC") ?? false,
      api_sid_valid: TWILIO_API_SID?.startsWith("SK") ?? false,
      twiml_app_valid: TWILIO_TWIML_APP_SID?.startsWith("AP") ?? false,
    });

    // Validate credential format BEFORE attempting token generation
    const errors: string[] = [];
    if (!TWILIO_ACCOUNT_SID) errors.push("TWILIO_ACCOUNT_SID missing");
    else if (!TWILIO_ACCOUNT_SID.startsWith("AC")) errors.push(`TWILIO_ACCOUNT_SID must start with 'AC', got '${TWILIO_ACCOUNT_SID.substring(0, 2)}'`);
    
    if (!TWILIO_API_SID) errors.push("TWILIO_API_SID missing");
    else if (!TWILIO_API_SID.startsWith("SK")) errors.push(`TWILIO_API_SID must start with 'SK', got '${TWILIO_API_SID.substring(0, 2)}'`);
    
    if (!TWILIO_API_SECRET) errors.push("TWILIO_API_SECRET missing");
    else if (TWILIO_API_SECRET.length < 20) errors.push("TWILIO_API_SECRET looks too short");
    
    if (!TWILIO_TWIML_APP_SID) errors.push("TWILIO_TWIML_APP_SID missing");
    else if (!TWILIO_TWIML_APP_SID.startsWith("AP")) errors.push(`TWILIO_TWIML_APP_SID must start with 'AP', got '${TWILIO_TWIML_APP_SID.substring(0, 2)}'`);

    if (errors.length > 0) {
      console.error("❌ Credential validation failed:", errors);
      return new Response(
        JSON.stringify({ 
          error: "Twilio Voice credentials invalid", 
          details: errors,
          hint: "Check Lovable Cloud secrets — ACCOUNT_SID must start with AC, API_SID with SK, TWIML_APP_SID with AP"
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const identity = `user_${user.id.replace(/-/g, "")}`;

    const accessToken = await createTwilioAccessToken(
      TWILIO_ACCOUNT_SID!,
      TWILIO_API_SID!,
      TWILIO_API_SECRET!,
      identity,
      TWILIO_TWIML_APP_SID!,
      3600,
    );

    console.log(`✅ Voice token generated for ${identity} (expires in 3600s)`);

    return new Response(
      JSON.stringify({ token: accessToken, identity }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Token generation error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
