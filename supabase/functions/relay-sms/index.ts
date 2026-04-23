import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RelayPayload {
  to_number: string;
  message_body: string;
  idempotency_key: string;
  source_project?: string;
  source_booking_id?: string;
  metadata?: Record<string, unknown>;
  explicit_provider?: "twilio" | "biztext";
  skip_cooldown?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const providedSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("TT_SMS_BRIDGE_SECRET");

    if (!expectedSecret) {
      console.error("[relay-sms] TT_SMS_BRIDGE_SECRET not configured");
      return json({ success: false, error: "Relay not configured" }, 500);
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
      console.warn("[relay-sms] Invalid or missing webhook secret");
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const payload: RelayPayload = await req.json();

    if (!payload.to_number || !payload.message_body || !payload.idempotency_key) {
      return json(
        { success: false, error: "Missing required fields: to_number, message_body, idempotency_key" },
        400,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: {
        to_number: payload.to_number,
        message_body: payload.message_body,
        idempotency_key: payload.idempotency_key,
        explicit_provider: payload.explicit_provider || "twilio",
        skip_cooldown: payload.skip_cooldown ?? false,
        metadata: {
          ...(payload.metadata || {}),
          source: payload.source_project || "toptier",
          source_booking_id: payload.source_booking_id || null,
          relayed_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      console.error("[relay-sms] send-sms invocation failed:", error);
      return json(
        { success: false, error: `Upstream send-sms failed: ${error.message}` },
        502,
      );
    }

    return json({ success: true, upstream: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[relay-sms] fatal:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
