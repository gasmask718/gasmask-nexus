import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const isValidSid = (value: string | null | undefined, prefix: string) =>
  typeof value === "string" && new RegExp(`^${prefix}[A-Za-z0-9]{32}$`).test(value);

const pickFirstValidSid = (prefix: string, ...values: Array<string | null | undefined>) =>
  values.find((value) => isValidSid(value, prefix)) ?? null;

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
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  // The TwiML app for Brandaro VA calls - we use the va-power-dialer twiml endpoint
  // We create a "virtual" TwiML app by embedding the voice URL in the token grant
  const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };

  const grants: Record<string, unknown> = {
    identity,
    voice: {
      incoming: { allow: true },
      outgoing: {
        application_sid: twimlAppSid,
      },
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID");
    const apiKeySid = Deno.env.get("BRANDARO_TWILIO_API_KEY_SID");
    const apiKeySecret = Deno.env.get("BRANDARO_TWILIO_API_KEY_SECRET");
    const rawTwimlAppSid = Deno.env.get("BRANDARO_TWILIO_TWIML_APP_SID");
    const fallbackTwimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");
    const twimlAppSid = pickFirstValidSid("AP", rawTwimlAppSid, fallbackTwimlAppSid);
    const brandaroAuthToken = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN");
    const fallbackAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!isValidSid(accountSid, "AC") || !isValidSid(apiKeySid, "SK") || !apiKeySecret) {
      return new Response(
        JSON.stringify({ configured: false, error: "Brandaro Twilio credentials not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // If no valid TwiML app SID, create one via Twilio API
    if (!twimlAppSid) {
      console.log("No valid BRANDARO_TWILIO_TWIML_APP_SID set - creating TwiML app...");
      const authCandidates = [brandaroAuthToken, fallbackAuthToken].filter((value, index, array) => value && array.indexOf(value) === index) as string[];
      if (authCandidates.length === 0) {
        return new Response(
          JSON.stringify({ configured: false, error: "A valid Twilio auth token is needed to create the Brandaro TwiML app" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const twimlUrl = `${SUPABASE_URL}/functions/v1/brandaro-call-twiml`;

      let createRes: Response | null = null;
      let lastCreateError = "Unknown error";

      for (const authToken of authCandidates) {
        createRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications.json`,
          {
            method: "POST",
            headers: {
              "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              FriendlyName: "Brandaro VA Dialer",
              VoiceUrl: twimlUrl,
              VoiceMethod: "POST",
              StatusCallback: `${SUPABASE_URL}/functions/v1/brandaro-call-status`,
              StatusCallbackMethod: "POST",
            }),
          },
        );

        if (createRes.ok) break;
        lastCreateError = await createRes.text();
        console.error("Failed to create TwiML app with one auth token:", lastCreateError);
      }

      if (!createRes?.ok) {
        return new Response(
          JSON.stringify({ configured: false, error: "Failed to create TwiML app: " + lastCreateError }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      const appData = await createRes.json();
      const newAppSid = appData.sid;
      console.log(`✅ Created Brandaro TwiML App: ${newAppSid}`);

      // Generate token with the new app SID
      // Note: The app SID should be saved as a secret for future use
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const jwtToken = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const identity = `brandaro_${user.id.replace(/-/g, "")}`;
      const ttl = 3600;

      // Temporarily patch grants to use the new app SID
      const token = await createBrandaroToken(accountSid, apiKeySid, apiKeySecret, identity, newAppSid, ttl);

      return new Response(
        JSON.stringify({
          token,
          identity,
          expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
          ttl,
          twiml_app_sid: newAppSid,
          note: "Save BRANDARO_TWILIO_TWIML_APP_SID=" + newAppSid + " as a secret for future use",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const identity = `brandaro_${user.id.replace(/-/g, "")}`;
    const ttl = 3600;

    const token = await createBrandaroToken(accountSid, apiKeySid, apiKeySecret, identity, twimlAppSid, ttl);

    return new Response(
      JSON.stringify({
        token,
        identity,
        expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
        ttl,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Brandaro token error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

async function createBrandaroToken(
  accountSid: string,
  apiKeySid: string,
  apiKeySecret: string,
  identity: string,
  twimlAppSid: string,
  ttl: number,
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

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}
