// twilio-recording-webhook — Twilio posts here when call recording completes.
// URL: /functions/v1/twilio-recording-webhook?log_id=<communication_logs.id>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  readForm,
  verifyTwilio,
} from "../_shared/dialer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const logId = url.searchParams.get("log_id");
    const params = await readForm(req);

    const verified = verifyTwilio(req, params);
    if (!verified.ok) {
      console.warn("[twilio-recording-webhook] signature failed", verified);
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }

    if (!logId) {
      console.warn("[twilio-recording-webhook] missing log_id");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const recordingUrl = params["RecordingUrl"];
    const recordingDuration = params["RecordingDuration"];
    const callSid = params["CallSid"];
    const recordingSid = params["RecordingSid"];

    console.log(
      `[twilio-recording-webhook] log=${logId} call=${callSid} rec=${recordingSid} dur=${recordingDuration}`,
    );

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const update: Record<string, unknown> = {
      delivery_status: "completed",
    };
    if (recordingUrl) update.recording_url = recordingUrl;
    if (recordingDuration) {
      const n = parseInt(recordingDuration, 10);
      if (!isNaN(n)) update.call_duration = n;
    }

    const { error } = await svc
      .from("communication_logs")
      .update(update)
      .eq("id", logId);

    if (error) {
      console.error("[twilio-recording-webhook] update failed", error);
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("[twilio-recording-webhook] error", e);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
