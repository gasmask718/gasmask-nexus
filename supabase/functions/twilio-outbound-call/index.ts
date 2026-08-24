import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSuppressed } from "../_shared/dnc.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalize any phone format to E.164 */
function toE164(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return `+${digits}`;
}

function extractTwilioErrorMessage(
  status: number,
  payload: Record<string, unknown> | null,
): string {
  const message = typeof payload?.message === "string" ? payload.message : "";
  const code = payload?.code ? ` (code ${String(payload.code)})` : "";
  if (message) return `${message}${code}`;
  return `Twilio call initiation failed (HTTP ${status})`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ success: false, error: "Backend environment is not configured." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid request body." }, 400);
    }

    if (body.dry_run) {
      return jsonResponse({ success: true, dry_run: true, function: "twilio-outbound-call" });
    }

    const queueItemId = String(body.queue_item_id || "");
    const requestedBusinessId = String(body.business_id || "");
    if (!queueItemId || !requestedBusinessId) {
      return jsonResponse(
        {
          success: false,
          error: "Missing IDs. Provide queue_item_id and business_id.",
        },
        400,
      );
    }

    const { data: item, error: itemErr } = await supabase
      .from("outbound_call_queue")
      .select(
        "id, phone_number, contact_name, business_id, campaign_id, dialer_campaigns(agent_id, amd_enabled)",
      )
      .eq("id", queueItemId)
      .maybeSingle();

    if (itemErr || !item) {
      console.error("❌ Queue item lookup failed:", itemErr);
      return jsonResponse({ success: false, error: "Queue item not found." }, 404);
    }

    // ── Unified suppression gate (dnc_list + opt_out_events), fails CLOSED ──
    const suppression = await isSuppressed(supabase, item.phone_number || "");
    if (suppression.blocked) {
      console.warn(
        `🚫 Suppressed call blocked (${suppression.source}): ${suppression.reason} — queue item ${queueItemId}`,
      );
      return jsonResponse({
        success: false,
        status: "blocked",
        reason: suppression.reason || "suppressed",
        source: suppression.source,
        error: `Recipient is suppressed (${suppression.reason || "suppressed"}).`,
      });
    }



    // Prefer Brandaro Twilio credentials (real AC... Account SID), fall back to legacy vars.
    const twilioAccountSid =
      Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID") ||
      Deno.env.get("TWILIO_ACCOUNT_SID") ||
      "";
    const twilioAuthToken =
      Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN") ||
      Deno.env.get("TWILIO_AUTH_TOKEN") ||
      "";
    const twilioPhoneNumber =
      Deno.env.get("TWILIO_FROM_NUMBER") ||
      Deno.env.get("TWILIO_PHONE_NUMBER") ||
      "";

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return jsonResponse({
        success: false,
        error:
          "Twilio is not configured. Required env vars: BRANDARO_TWILIO_ACCOUNT_SID, BRANDARO_TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.",
      });
    }

    // Twilio Account SIDs MUST start with 'AC'. 'US' values are API Key SIDs and will 401.
    if (!twilioAccountSid.startsWith("AC")) {
      console.error(`❌ Invalid Twilio Account SID prefix: ${twilioAccountSid.slice(0, 4)}...`);
      return jsonResponse({
        success: false,
        error:
          "Invalid Twilio Account SID. Account SIDs must start with 'AC'. The configured value looks like an API Key SID ('US...'). Update BRANDARO_TWILIO_ACCOUNT_SID with the real Account SID from Twilio Console.",
      }, 401);
    }

    const campaign = Array.isArray(item.dialer_campaigns)
      ? item.dialer_campaigns[0]
      : item.dialer_campaigns;

    // Bland AI agent — campaign-level override or default sales agent.
    const resolvedAgentId =
      campaign?.agent_id ||
      Deno.env.get("BRANDARO_SALES_AGENT_ID") ||
      Deno.env.get("DC_SALES_AGENT_ID") ||
      "";

    const toNumber = toE164(item.phone_number || "");
    if (!toNumber) {
      return jsonResponse({ success: false, error: "Invalid destination phone number." });
    }

    const projectId = new URL(supabaseUrl).hostname.split(".")[0];
    // Bridge through twilio-bridge-to-bland which forwards the campaign script + agent to Bland AI.
    const bridgeParams = new URLSearchParams();
    if (resolvedAgentId) bridgeParams.set("bland_agent_id", resolvedAgentId);
    if (campaign?.id) bridgeParams.set("campaign_id", String(campaign.id));
    if (queueItemId) bridgeParams.set("queue_item_id", String(queueItemId));
    const twimlWebhookUrl =
      `https://${projectId}.supabase.co/functions/v1/twilio-bridge-to-bland?${bridgeParams.toString()}`;
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
    const authHeader = `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`;

    const params = new URLSearchParams();
    params.append("To", toNumber);
    params.append("From", twilioPhoneNumber);
    params.append("Url", twimlWebhookUrl);
    params.append("Method", "POST");
    params.append("StatusCallback", statusCallbackUrl);
    params.append("StatusCallbackMethod", "POST");
    // Repeated params — a space-joined single value subscribes to nothing.
    for (const ev of ["initiated", "ringing", "answered", "completed"]) {
      params.append("StatusCallbackEvent", ev);
    }
    params.append("Record", "true");
    params.append("RecordingChannels", "dual");
    params.append("RecordingStatusCallback", `${supabaseUrl}/functions/v1/twilio-recording-callback`);
    params.append("RecordingStatusCallbackMethod", "POST");
    params.append("Timeout", "30");

    if (campaign?.amd_enabled) {
      params.append("MachineDetection", "Enable");
      params.append("MachineDetectionTimeout", "8");
    }

    console.log(
      `📞 twilio-outbound-call | to=${toNumber} from=${twilioPhoneNumber} queue_item=${queueItemId} agent_id=${resolvedAgentId}`,
    );

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const twilioRaw = await twilioRes.text();
    let twilioData: Record<string, unknown> | null = null;
    try {
      twilioData = twilioRaw ? JSON.parse(twilioRaw) : null;
    } catch {
      twilioData = { message: twilioRaw };
    }

    if (!twilioRes.ok) {
      const twilioMessage = extractTwilioErrorMessage(twilioRes.status, twilioData);
      console.error(`❌ Twilio call failed: ${twilioMessage}`, twilioData);

      await supabase
        .from("outbound_call_queue")
        .update({
          status: "failed",
          notes: `[TWILIO_ERROR] ${twilioMessage}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueItemId);

      // Return 200 with success=false so existing UI surfaces exact error text.
      return jsonResponse({
        success: false,
        error: twilioMessage,
        twilio_status: twilioRes.status,
        details: twilioData,
      });
    }

    const callSid = String(twilioData?.sid || "").trim();
    if (!callSid) {
      return jsonResponse({
        success: false,
        error: "Twilio response missing call SID.",
        details: twilioData,
      });
    }

    await supabase
      .from("outbound_call_queue")
      .update({
        twilio_call_sid: callSid,
        status: "dialing",
        dialing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queueItemId);

    const { error: recordingError } = await supabase.from("call_recordings").insert({
      provider_call_sid: callSid,
      business_id: item.business_id || requestedBusinessId,
      direction: "outbound",
      status: "initiated",
      provider: "twilio",
      channels: "dual",
      from_number: twilioPhoneNumber,
      to_number: toNumber,
      created_at: new Date().toISOString(),
    });

    if (recordingError) {
      console.error(`⚠️ call_recordings pre-insert failed (non-fatal): ${recordingError.message}`);
    }

    return jsonResponse({
      success: true,
      call_sid: callSid,
      to: toNumber,
      from: twilioPhoneNumber,
      agent_id: resolvedAgentId,
      twiml_webhook_url: twimlWebhookUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("💥 twilio-outbound-call error:", message);
    return jsonResponse({ success: false, error: message });
  }
});
