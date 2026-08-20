import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * TWIML APP DISCOVERY — FORENSIC AUDITOR
 * 
 * Read-only inspection of existing Twilio TwiML Apps.
 * Does NOT create, modify, or delete anything.
 * 
 * Phases:
 *   1. Environment secret scan for AP* SIDs
 *   2. Twilio API: list all TwiML Apps
 *   3. Route match detection against known endpoints
 *   4. Recent call history: detect active app usage
 *   5. Provider link analysis
 *   6. Final verdict
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KNOWN_ENDPOINTS = [
  "twilio-voice-twiml",
  "elevenlabs-bridge",
  "twilio-elevenlabs-bridge",
  "aws-polly-bridge",
  "aws-polly-tts",
  "outbound-call-handler",
  "twilio-outbound-call",
  "voice-router",
  "cold-call-tts-webhook",
];

interface TwimlApp {
  sid: string;
  friendly_name: string;
  voice_url: string | null;
  date_updated: string;
  date_created: string;
  routing_match: boolean;
  matched_endpoint: string | null;
  provider: string | null;
}

interface CallUsage {
  most_used_app: string | null;
  usage_count: number;
  last_call_time: string | null;
  app_usage_map: Record<string, number>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
    const apiSid = Deno.env.get("TWILIO_API_SID") || "";
    const apiSecret = Deno.env.get("TWILIO_API_SECRET") || "";
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
    const configuredAppSid = Deno.env.get("TWILIO_TWIML_APP_SID") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

    // ── PHASE 1: Secret scan ──
    const envDiscovery: { sid: string; source: string }[] = [];
    if (/^AP[a-f0-9]{32}$/i.test(configuredAppSid)) {
      envDiscovery.push({ sid: configuredAppSid, source: "TWILIO_TWIML_APP_SID" });
    }

    // ── PHASE 2: List TwiML Apps from Twilio ──
    const authPair = authToken && authToken.length >= 20
      ? `${accountSid}:${authToken}`
      : `${apiSid}:${apiSecret}`;
    const basicAuth = btoa(authPair);

    let twilioApps: TwimlApp[] = [];
    let twilioApiError: string | null = null;

    try {
      const appsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications.json?PageSize=50`,
        { headers: { Authorization: `Basic ${basicAuth}` } }
      );

      if (!appsRes.ok) {
        twilioApiError = `Twilio API returned ${appsRes.status}`;
        const body = await appsRes.text();
        console.error("Twilio API error:", body);
      } else {
        const appsData = await appsRes.json();
        const applications = appsData.applications || [];

        // ── PHASE 3: Route match detection ──
        twilioApps = applications.map((app: any) => {
          const voiceUrl = app.voice_url || "";
          let matchedEndpoint: string | null = null;
          let provider: string | null = null;

          for (const ep of KNOWN_ENDPOINTS) {
            if (voiceUrl.toLowerCase().includes(ep.toLowerCase())) {
              matchedEndpoint = ep;
              break;
            }
          }

          // ── PHASE 5: Provider link ──
          const urlLower = voiceUrl.toLowerCase();
          if (urlLower.includes("elevenlabs")) provider = "ELEVENLABS";
          else if (urlLower.includes("polly") || urlLower.includes("aws")) provider = "AWS_TTS";
          else if (urlLower.includes("twiml") || urlLower.includes("voice")) provider = "VOICE_ROUTER";
          else if (matchedEndpoint) provider = "HYBRID";

          return {
            sid: app.sid,
            friendly_name: app.friendly_name || "(unnamed)",
            voice_url: voiceUrl || null,
            date_updated: app.date_updated,
            date_created: app.date_created,
            routing_match: !!matchedEndpoint,
            matched_endpoint: matchedEndpoint,
            provider,
          };
        });
      }
    } catch (err) {
      twilioApiError = `Failed to reach Twilio API: ${err instanceof Error ? err.message : String(err)}`;
    }

    // ── PHASE 4: Recent call history ──
    let callUsage: CallUsage = {
      most_used_app: null,
      usage_count: 0,
      last_call_time: null,
      app_usage_map: {},
    };

    if (!twilioApiError) {
      try {
        const callsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json?PageSize=50`,
          { headers: { Authorization: `Basic ${basicAuth}` } }
        );
        if (callsRes.ok) {
          const callsData = await callsRes.json();
          const calls = callsData.calls || [];
          const usageMap: Record<string, number> = {};

          for (const call of calls) {
            const appSid = call.application_sid;
            if (appSid) {
              usageMap[appSid] = (usageMap[appSid] || 0) + 1;
            }
          }

          let maxApp: string | null = null;
          let maxCount = 0;
          for (const [sid, count] of Object.entries(usageMap)) {
            if (count > maxCount) {
              maxApp = sid;
              maxCount = count;
            }
          }

          callUsage = {
            most_used_app: maxApp,
            usage_count: maxCount,
            last_call_time: calls.length > 0 ? calls[0].date_created : null,
            app_usage_map: usageMap,
          };
        } else {
          await callsRes.text(); // consume body
        }
      } catch (err) {
        console.error("Call history fetch error:", err);
      }
    }

    // ── PHASE 6: Final verdict ──
    const matchedApps = twilioApps.filter(a => a.routing_match);
    const configuredMatch = twilioApps.find(a => a.sid === configuredAppSid);

    let verdict: string;
    let verdict_detail: string;

    if (twilioApiError) {
      verdict = "API_ERROR";
      verdict_detail = twilioApiError;
    } else if (configuredMatch && configuredMatch.routing_match) {
      verdict = "EXISTING_APP_VERIFIED";
      verdict_detail = `Configured SID ${configuredAppSid} is active and routes to ${configuredMatch.matched_endpoint}`;
    } else if (configuredMatch) {
      verdict = "EXISTING_APP_VERIFIED";
      verdict_detail = `Configured SID ${configuredAppSid} exists but voice_url may need updating`;
    } else if (matchedApps.length > 1) {
      verdict = "MULTIPLE_APPS_FOUND";
      verdict_detail = `${matchedApps.length} TwiML Apps match known system endpoints`;
    } else if (matchedApps.length === 1) {
      verdict = "EXISTING_APP_VERIFIED";
      verdict_detail = `Found matching app: ${matchedApps[0].sid} → ${matchedApps[0].matched_endpoint}`;
    } else if (twilioApps.length > 0) {
      verdict = "APPS_FOUND_NO_MATCH";
      verdict_detail = `${twilioApps.length} TwiML Apps exist but none match known endpoints`;
    } else {
      verdict = "NO_APP_FOUND";
      verdict_detail = "No TwiML Apps found on this account — safe to create new";
    }

    return new Response(JSON.stringify({
      verdict,
      verdict_detail,
      env_discovery: envDiscovery,
      configured_app_sid: configuredAppSid || null,
      configured_app_match: configuredMatch ? {
        sid: configuredMatch.sid,
        friendly_name: configuredMatch.friendly_name,
        voice_url: configuredMatch.voice_url,
        routing_match: configuredMatch.routing_match,
        matched_endpoint: configuredMatch.matched_endpoint,
        provider: configuredMatch.provider,
      } : null,
      twilio_apps: twilioApps,
      twilio_api_error: twilioApiError,
      call_usage: callUsage,
      total_apps_found: twilioApps.length,
      matched_apps_count: matchedApps.length,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Discovery error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
