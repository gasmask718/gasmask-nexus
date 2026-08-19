/**
 * _shared/sendSms.ts — canonical outbound SMS entry point for edge functions.
 *
 * Phase 2 of the Twilio egress standardization: NO edge function should POST to
 * https://api.twilio.com/.../Messages.json directly. Everything routes through
 * the `send-sms` function, which owns:
 *   - suppression / DNC (dnc_list + opt_out_events)
 *   - idempotency (outbound_messages.idempotency_key)
 *   - daily send limits, per-number cooldown, duplicate-content detection
 *   - credential rules (AC-prefixed SID, A2P 10DLC guard, provider fallback)
 *   - a single audit trail in `outbound_messages`
 *
 * This helper never throws — callers get a structured result so their existing
 * per-recipient error handling keeps working. Twilio credentials never leave
 * the `send-sms` function.
 */

/**
 * The class a send belongs to. NO default — the caller must state it.
 * `internal` / `test` traffic does NOT belong here: it goes through
 * _shared/twilioSend.ts in-process, so alerting never queues behind campaigns.
 */
export type SendSmsClass = "campaign" | "transactional" | "workforce" | "conversational";

export interface SendSmsOptions {
  to: string;
  body: string;
  /** Deterministic key so cron re-runs / retries do not double-send. */
  idempotencyKey: string;
  /** Mandatory. Drives daily budget, cooldown scope and suppression depth. */
  sendClass: SendSmsClass;
  /** Brand-scoped sender override (e.g. BRANDARO_TWILIO_NUMBER). */
  from?: string | null;
  /** Analytics tag, e.g. "sbo_picks", "dd_cart_recovery". */
  purpose?: string;
  metadata?: Record<string, unknown>;
  /** Skip the per-number cooldown for legitimate per-event sends. */
  skipCooldown?: boolean;
  /** Defaults to "twilio" — these callers were Twilio-specific before. */
  provider?: "twilio" | "biztext";
  storeId?: string | null;
  campaignId?: string | null;
  /**
   * Ceiling for this campaign_id. Pass the recipient count: a loop bug that
   * re-sends the same list gets stopped at the cap instead of at the daily
   * budget (or not at all).
   */
  campaignMaxSends?: number | null;
}


export interface SendSmsResult {
  success: boolean;
  /** "sent" | "blocked" | "cooldown" | "duplicate" | "rate_limited" | "error" | ... */
  status: string;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** True when send-sms refused because the number is suppressed/opted out. */
  blocked: boolean;
  raw: unknown;
}

function fail(status: string, message: string, raw?: unknown): SendSmsResult {
  return {
    success: false,
    status,
    providerMessageId: null,
    errorCode: status,
    errorMessage: message,
    blocked: status === "blocked",
    raw: raw ?? null,
  };
}

export async function sendSms(opts: SendSmsOptions): Promise<SendSmsResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return fail("misconfigured", "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available");
  }
  if (!opts.to || !opts.body) {
    return fail("invalid_request", "to and body are required");
  }
  if (!opts.idempotencyKey) {
    return fail("invalid_request", "idempotencyKey is required");
  }
  if (!opts.sendClass) {
    return fail("invalid_request", "sendClass is required (campaign | transactional | workforce | conversational)");
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        to_number: opts.to,
        message_body: opts.body,
        idempotency_key: opts.idempotencyKey,
        send_class: opts.sendClass,
        campaign_max_sends: opts.campaignMaxSends ?? undefined,
        from_number: opts.from || undefined,
        explicit_provider: opts.provider ?? "twilio",
        skip_cooldown: opts.skipCooldown ?? false,
        purpose: opts.purpose,
        metadata: opts.metadata,
        store_id: opts.storeId ?? undefined,
        campaign_id: opts.campaignId ?? undefined,
      }),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw_response: text };
    }

    if (!res.ok) {
      const message = data?.error || data?.error_message || text || `send-sms HTTP ${res.status}`;
      return {
        success: false,
        status: data?.status || String(res.status),
        providerMessageId: null,
        errorCode: data?.error_code || String(res.status),
        errorMessage: String(message).slice(0, 500),
        blocked: false,
        raw: data,
      };
    }

    const status = data?.status || (data?.success ? "sent" : "error");
    return {
      success: Boolean(data?.success),
      status,
      providerMessageId: data?.provider_message_id ?? null,
      errorCode: data?.error_code ?? null,
      errorMessage: data?.error_message ?? data?.reason ?? data?.error ?? null,
      blocked: status === "blocked",
      raw: data,
    };
  } catch (e) {
    return fail("network", e instanceof Error ? e.message : String(e));
  }
}

/** Short stable hash used to build content-aware idempotency keys. */
export async function smsContentHash(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
