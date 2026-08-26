/**
 * funding-sms-queue-processor
 *
 * Drains public.funding_sms_queue through the canonical send-sms path.
 * - Rows are claimed transactionally (claim_funding_sms_batch → FOR UPDATE SKIP LOCKED),
 *   so concurrent invocations never grab the same row.
 * - Every send carries a deterministic idempotency key (`funding_sms:<row id>`),
 *   so a retry after a crash cannot double-send.
 * - send_class is "transactional": these are program-status messages tied to a
 *   specific funding client event, never marketing.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSms } from "../_shared/sendSms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let limit = 20;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (typeof body?.limit === "number") limit = Math.max(1, Math.min(100, body.limit));
  } catch { /* defaults */ }

  const { data: claimed, error: claimErr } = await supabase.rpc("claim_funding_sms_batch", {
    p_limit: limit,
    p_max_attempts: MAX_ATTEMPTS,
  });

  if (claimErr) {
    console.error("[funding-sms] claim failed:", claimErr.message);
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (claimed ?? []) as Array<{
    id: string;
    phone_number: string;
    message_body: string;
    related_kind: string;
    related_id: string | null;
    attempts: number;
  }>;

  let sent = 0, blocked = 0, failed = 0, requeued = 0;

  for (const row of rows) {
    const result = await sendSms({
      to: row.phone_number,
      body: row.message_body,
      idempotencyKey: `funding_sms:${row.id}`,
      sendClass: "transactional",
      purpose: `funding_${row.related_kind}`,
      metadata: { queue_id: row.id, related_kind: row.related_kind, related_id: row.related_id },
      skipCooldown: true,
    });

    if (result.success) {
      sent++;
      await supabase.from("funding_sms_queue").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        twilio_sid: result.providerMessageId,
        provider_status: result.status,
        error: null,
      }).eq("id", row.id);
      continue;
    }

    if (result.blocked) {
      blocked++;
      await supabase.from("funding_sms_queue").update({
        status: "blocked",
        provider_status: result.status,
        error: result.errorMessage ?? "suppressed / opted out",
      }).eq("id", row.id);
      continue;
    }

    const exhausted = (row.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS;
    if (exhausted) failed++; else requeued++;
    await supabase.from("funding_sms_queue").update({
      status: exhausted ? "failed" : "queued",
      provider_status: result.status,
      error: result.errorMessage ?? result.status,
    }).eq("id", row.id);
  }

  const summary = { claimed: rows.length, sent, blocked, failed, requeued };
  console.log("[funding-sms]", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
