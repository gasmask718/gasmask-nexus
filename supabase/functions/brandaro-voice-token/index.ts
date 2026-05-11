import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import twilio from "npm:twilio@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const isValidSid = (value: string | null | undefined, prefix: string) =>
  typeof value === "string" && new RegExp(`^${prefix}[A-Za-z0-9]{32}$`).test(value);

const pickFirstValidSid = (prefix: string, ...values: Array<string | null | undefined>) =>
  values.find((value) => isValidSid(value, prefix)) ?? null;

const readSecret = (name: string) => {
  const value = Deno.env.get(name);
  return typeof value === "string" ? value.trim() : null;
};

const twilioBasicAuth = (username: string, password: string) =>
  `Basic ${btoa(`${username}:${password}`)}`;

async function validateTwilioApiKey(accountSid: string, apiKeySid: string, apiKeySecret: string) {
  // Use IncomingPhoneNumbers.json which works with restricted API keys (only requires
  // standard voice/messaging perms — NOT iam/accounts/read which restricted keys lack).
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=1`,
    { headers: { Authorization: twilioBasicAuth(apiKeySid, apiKeySecret) } },
  );

  if (response.ok) {
    return { ok: true as const, detail: "API key authenticated against Brandaro account" };
  }

  const detail = await response.text();
  // 70051 = restricted-key permission gap on this specific endpoint. Treat as OK
  // because the TwiML-app validation step below is the authoritative check for what
  // we actually need (voice grant + outgoing app SID).
  if (response.status === 401 && detail.includes("70051")) {
    return { ok: true as const, detail: "API key is restricted; deferring to TwiML app validation" };
  }

  const sidInfo = `apiKeySid prefix=${apiKeySid.slice(0,2)} len=${apiKeySid.length}`;
  const secretInfo = `secret len=${apiKeySecret.length}`;
  return {
    ok: false as const,
    detail: `Twilio ${response.status} for ${accountSid}. ${sidInfo}. ${secretInfo}. Raw: ${detail.slice(0, 200)}`,
  };
}

async function validateTwimlApp(accountSid: string, apiKeySid: string, apiKeySecret: string, twimlAppSid: string) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications/${twimlAppSid}.json`, {
    headers: {
      Authorization: twilioBasicAuth(apiKeySid, apiKeySecret),
    },
  });

  if (response.ok) {
    const body = await response.json().catch(() => null);
    return { ok: true as const, detail: "Brandaro TwiML app belongs to the same Twilio account", app: body };
  }

  const detail = await response.text();
  return {
    ok: false as const,
    detail: `BRANDARO_TWILIO_TWIML_APP_SID is not accessible from ${accountSid}: HTTP ${response.status} ${detail.slice(0, 200)}`,
    app: null,
  };
}

// Self-heal: ensure the TwiML App's VoiceUrl points at brandaro-call-twiml so
// the user-selected CallerId param actually reaches <Dial callerId="...">.
async function ensureTwimlAppVoiceUrl(
  accountSid: string,
  apiKeySid: string,
  apiKeySecret: string,
  twimlAppSid: string,
  expectedVoiceUrl: string,
  currentApp: any,
) {
  try {
    const currentUrl: string = currentApp?.voice_url || "";
    if (currentUrl === expectedVoiceUrl && (currentApp?.voice_method || "POST").toUpperCase() === "POST") {
      return { updated: false };
    }
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications/${twimlAppSid}.json`,
      {
        method: "POST",
        headers: {
          Authorization: twilioBasicAuth(apiKeySid, apiKeySecret),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ VoiceUrl: expectedVoiceUrl, VoiceMethod: "POST" }),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[brandaro-voice-token] Could not auto-update VoiceUrl: ${res.status} ${txt.slice(0, 200)}`);
      return { updated: false, error: txt };
    }
    console.log(`[brandaro-voice-token] ✅ Updated TwiML App ${twimlAppSid} VoiceUrl: ${currentUrl || "(empty)"} → ${expectedVoiceUrl}`);
    return { updated: true, previous: currentUrl };
  } catch (e) {
    console.warn(`[brandaro-voice-token] ensureTwimlAppVoiceUrl error:`, e);
    return { updated: false };
  }
}

function createBrandaroToken(
  accountSid: string,
  apiKeySid: string,
  apiKeySecret: string,
  identity: string,
  twimlAppSid: string,
  ttl: number,
): string {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const accessToken = new AccessToken(accountSid, apiKeySid, apiKeySecret, { identity, ttl });
  accessToken.addGrant(new VoiceGrant({
    incomingAllow: true,
    outgoingApplicationSid: twimlAppSid,
  }));

  return accessToken.toJwt();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = readSecret("BRANDARO_TWILIO_ACCOUNT_SID");
    const apiKeySid = readSecret("BRANDARO_TWILIO_API_KEY_SID");
    const apiKeySecret = readSecret("BRANDARO_TWILIO_API_KEY_SECRET");
    const rawTwimlAppSid = readSecret("BRANDARO_TWILIO_TWIML_APP_SID");
    const fallbackTwimlAppSid = readSecret("TWILIO_TWIML_APP_SID");
    const twimlAppSid = pickFirstValidSid("AP", rawTwimlAppSid, fallbackTwimlAppSid);
    const brandaroAuthToken = readSecret("BRANDARO_TWILIO_AUTH_TOKEN");
    const fallbackAuthToken = readSecret("TWILIO_AUTH_TOKEN");
    const health = {
      BRANDARO_TWILIO_ACCOUNT_SID: isValidSid(accountSid, "AC"),
      BRANDARO_TWILIO_API_KEY_SID: isValidSid(apiKeySid, "SK"),
      BRANDARO_TWILIO_API_KEY_SECRET: Boolean(apiKeySecret),
      BRANDARO_TWILIO_TWIML_APP_SID: Boolean(twimlAppSid),
    };

    if (!isValidSid(accountSid, "AC") || !isValidSid(apiKeySid, "SK") || !apiKeySecret) {
      return new Response(
        JSON.stringify({ configured: false, error: "Brandaro Twilio credentials not configured", health }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // If no valid TwiML app SID, create one via Twilio API
    if (!twimlAppSid) {
      console.log("No valid BRANDARO_TWILIO_TWIML_APP_SID set - creating TwiML app...");
      const authCandidates = [brandaroAuthToken, fallbackAuthToken].filter((value, index, array) => value && array.indexOf(value) === index) as string[];
      if (authCandidates.length === 0) {
        return new Response(
          JSON.stringify({ configured: false, error: "A valid Twilio auth token is needed to create the Brandaro TwiML app", health }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      const SUPABASE_URL = readSecret("SUPABASE_URL")!;
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
          JSON.stringify({ configured: false, error: "Failed to create TwiML app: " + lastCreateError, health }),
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

      const supabase = createClient(readSecret("SUPABASE_URL")!, readSecret("SUPABASE_SERVICE_ROLE_KEY")!);
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
      const apiValidation = await validateTwilioApiKey(accountSid, apiKeySid, apiKeySecret);
      if (!apiValidation.ok) {
        return new Response(JSON.stringify({ configured: false, error: apiValidation.detail, health }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const token = createBrandaroToken(accountSid, apiKeySid, apiKeySecret, identity, newAppSid, ttl);

      return new Response(
        JSON.stringify({
          token,
          identity,
          expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
          ttl,
          twiml_app_sid: newAppSid,
          health: { ...health, BRANDARO_TWILIO_TWIML_APP_SID: true },
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

    const supabase = createClient(readSecret("SUPABASE_URL")!, readSecret("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const identity = `brandaro_${user.id.replace(/-/g, "")}`;
    const ttl = 3600;

    const apiValidation = await validateTwilioApiKey(accountSid, apiKeySid, apiKeySecret);
    if (!apiValidation.ok) {
      return new Response(JSON.stringify({ configured: false, error: apiValidation.detail, health }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const appValidation = await validateTwimlApp(accountSid, apiKeySid, apiKeySecret, twimlAppSid);
    if (!appValidation.ok) {
      return new Response(JSON.stringify({ configured: false, error: appValidation.detail, health }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = createBrandaroToken(accountSid, apiKeySid, apiKeySecret, identity, twimlAppSid, ttl);

    return new Response(
      JSON.stringify({
        token,
        identity,
        expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
        ttl,
        health,
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

