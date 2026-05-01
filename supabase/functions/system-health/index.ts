import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();

    // ── All queries in parallel for speed ──
    const [
      queueRes,
      liveCallsRes,
      agentsRes,
      lastWebhookRes,
    ] = await Promise.all([
      // Queue depth
      supabase
        .from("outbound_call_queue")
        .select("status", { count: "exact", head: false })
        .in("status", ["queued", "dialing"]),

      // Active live calls
      supabase
        .from("live_calls")
        .select("state, updated_at", { count: "exact", head: false })
        .in("state", ["queued", "dialing", "ringing", "answered", "ai_active", "human_connected"]),

      // Agent availability
      supabase
        .from("dialer_agent_availability")
        .select("status"),

      // Last webhook activity (observability)
      supabase
        .from("live_calls")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

    // ── EXECUTION PLANE ──
    const queueItems = queueRes.data || [];
    const queueDepth = queueItems.filter(i => i.status === "queued").length;
    const dialingCount = queueItems.filter(i => i.status === "dialing").length;
    const activeCalls = (liveCallsRes.data || []).length;

    // Dialer engine staleness: check if items are stuck in dialing >120s
    // (lightweight heuristic without needing a separate cycle log table)
    const dialerEngine = dialingCount > 0 && queueDepth === 0 ? "ok" : 
                          queueDepth > 0 ? "ok" : "idle";

    // ── VOICE HEALTH ──
    // Prefer Brandaro-dedicated Twilio (per Brandaro Twilio Voice Integration standard),
    // then fall back to legacy platform Twilio credentials.
    const brandaroSid = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID");
    const brandaroApiSid = Deno.env.get("BRANDARO_TWILIO_API_KEY_SID");
    const brandaroApiSecret = Deno.env.get("BRANDARO_TWILIO_API_KEY_SECRET");
    const brandaroAuthToken = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN");
    const brandaroTwimlApp = Deno.env.get("BRANDARO_TWILIO_TWIML_APP_SID");

    const legacySid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const legacyApiSid = Deno.env.get("TWILIO_API_SID");
    const legacyApiSecret = Deno.env.get("TWILIO_API_SECRET");
    const legacyAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const legacyTwimlApp = Deno.env.get("TWILIO_TWIML_APP_SID");

    // Pick the first credential set that has SID + (API Key OR Auth Token)
    let activeSid: string | undefined;
    let activeUser: string | undefined;
    let activePass: string | undefined;
    let activeSource: "brandaro_api_key" | "brandaro_auth_token" | "legacy_api_key" | "legacy_auth_token" | "none" = "none";

    if (brandaroSid && brandaroApiSid && brandaroApiSecret) {
      activeSid = brandaroSid; activeUser = brandaroApiSid; activePass = brandaroApiSecret; activeSource = "brandaro_api_key";
    } else if (brandaroSid && brandaroAuthToken) {
      activeSid = brandaroSid; activeUser = brandaroSid; activePass = brandaroAuthToken; activeSource = "brandaro_auth_token";
    } else if (legacySid && legacyApiSid && legacyApiSecret) {
      activeSid = legacySid; activeUser = legacyApiSid; activePass = legacyApiSecret; activeSource = "legacy_api_key";
    } else if (legacySid && legacyAuthToken) {
      activeSid = legacySid; activeUser = legacySid; activePass = legacyAuthToken; activeSource = "legacy_auth_token";
    }

    let twilioApi: "connected" | "error" | "unconfigured" = "unconfigured";
    let twilioError: string | undefined;
    let twilioAccountStatus: string | undefined;

    if (activeSid && activeUser && activePass) {
      // Validate AC prefix per Twilio SID standard (subaccounts use SA)
      if (!/^(AC|SA)/.test(activeSid)) {
        twilioApi = "error";
        twilioError = `Invalid Twilio Account SID prefix (expected AC or SA, got "${activeSid.slice(0, 2)}") on source=${activeSource}`;
      } else {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${activeSid}.json`,
            {
              headers: { Authorization: "Basic " + btoa(`${activeUser}:${activePass}`) },
              signal: controller.signal,
            },
          );
          clearTimeout(timeout);
          if (res.ok) {
            const body = await res.json().catch(() => ({}));
            twilioAccountStatus = body?.status;
            twilioApi = body?.status === "active" ? "connected" : "error";
            if (twilioApi === "error") twilioError = `Twilio account status=${body?.status}`;
          } else {
            twilioApi = "error";
            const errText = await res.text().catch(() => "");
            twilioError = `Twilio HTTP ${res.status}: ${errText.slice(0, 200)}`;
          }
        } catch (e) {
          twilioApi = "error";
          twilioError = e instanceof Error ? e.message : String(e);
        }
      }
    }

    const hasTwimlApp = !!(brandaroTwimlApp || legacyTwimlApp);
    const tokenAuthority = (activeSid && activeUser && activePass && hasTwimlApp) ? "ok" : "invalid";

    // ── PROVIDERS ──
    const hasElevenLabs = !!Deno.env.get("ELEVENLABS_API_KEY");
    const hasPolly = !!Deno.env.get("AWS_ACCESS_KEY_ID") && !!Deno.env.get("AWS_SECRET_ACCESS_KEY");

    // ── AGENTS ──
    const agents = agentsRes.data || [];
    const onlineAgents = agents.filter(a => a.status === "available").length;
    const routingReady = onlineAgents > 0;

    // ── OBSERVABILITY ──
    const lastWebhook = lastWebhookRes.data?.[0]?.updated_at;
    const lastWebhookSeconds = lastWebhook
      ? Math.round((now - new Date(lastWebhook).getTime()) / 1000)
      : -1;
    const liveCallsStream: "connected" | "idle" =
      lastWebhookSeconds >= 0 && lastWebhookSeconds < 300 ? "connected" : "idle";

    // ── OVERALL STATUS ──
    let overallStatus: "healthy" | "degraded" | "down" = "healthy";

    if (tokenAuthority === "invalid" || twilioApi === "error") {
      overallStatus = "down";
    } else if (
      (queueDepth > 0 && !routingReady) ||
      (queueDepth > 0 && liveCallsStream === "idle" && lastWebhookSeconds > 300)
    ) {
      overallStatus = "degraded";
    }

    const response = {
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,

      execution: {
        dialer_engine: dialerEngine,
        active_calls: activeCalls,
        queue_depth: queueDepth,
        dialing: dialingCount,
      },

      voice: {
        token_authority: tokenAuthority,
        twilio_api: twilioApi,
        twilio_source: activeSource,
        twilio_account_status: twilioAccountStatus,
        twilio_error: twilioError,
        twiml_app_configured: hasTwimlApp,
      },

      providers: {
        elevenlabs: hasElevenLabs ? "configured" : "missing",
        aws_polly: hasPolly ? "configured" : "missing",
      },

      agents: {
        online_agents: onlineAgents,
        total_agents: agents.length,
        routing_ready: routingReady,
      },

      observability: {
        live_calls_stream: liveCallsStream,
        last_webhook_seconds: lastWebhookSeconds,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overall_status: "down",
        error: String(err),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
