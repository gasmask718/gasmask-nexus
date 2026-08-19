import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSuppressed } from "../_shared/dnc.ts";
import { legalStopBlocked } from "../_shared/twilioSend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Provider Adapters ──────────────────────────────────────────────────

// US toll-free numbers (800/833/844/855/866/877/888) use Twilio's Toll-Free
// Verification flow — they are NOT subject to A2P 10DLC. Once verified, they
// can send to US carriers without a Messaging Service.
function isUsTollFree(e164: string): boolean {
  const m = e164.match(/^\+1(8\d{2})\d{7}$/);
  if (!m) return false;
  return ["800", "833", "844", "855", "866", "877", "888"].includes(m[1]);
}

async function sendViaTwilio(to: string, body: string, fromOverride?: string): Promise<ProviderResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const apiSid = Deno.env.get("TWILIO_API_SID") || Deno.env.get("TWILIO_API_KEY") || undefined;
  const apiSecret = Deno.env.get("TWILIO_API_SECRET") || undefined;
  // Default From: the verified toll-free. If TWILIO_PHONE_NUMBER is set to a
  // US long code (anything other than 800/833/844/855/866/877/888), we IGNORE
  // it and fall back to the toll-free — carriers drop unregistered long codes
  // (error 30034) and we refuse to silently queue dead messages.
  const envFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
  const VERIFIED_TOLL_FREE = "+18776818621";
  const envFromValid = envFrom && (isUsTollFree(envFrom) || !envFrom.startsWith("+1"));
  const envFromSafe = envFromValid ? envFrom! : VERIFIED_TOLL_FREE;
  if (envFrom && !envFromValid && !fromOverride) {
    // C8: surface silent fallback so admins know the configured number was bypassed
    console.warn(
      `⚠️ TWILIO_FALLBACK_USED: configured TWILIO_PHONE_NUMBER=${envFrom} is an unregistered US long code — ` +
      `overriding to verified toll-free ${VERIFIED_TOLL_FREE} to avoid carrier error 30034. ` +
      `Register the number for A2P 10DLC or set TWILIO_MESSAGING_SERVICE_SID to silence this warning.`
    );
  }
  const from = fromOverride || envFromSafe;
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || undefined;

  if (!sid) return { success: false, error_code: "NO_CREDENTIALS", error_message: "Missing TWILIO_ACCOUNT_SID" };
  if (!sid.startsWith("AC")) {
    return { success: false, error_code: "INVALID_SID", error_message: "TWILIO_ACCOUNT_SID must start with AC" };
  }
  if (!token && !(apiSid && apiSecret)) {
    return { success: false, error_code: "NO_CREDENTIALS", error_message: "Missing Twilio auth credentials" };
  }

  // ── A2P 10DLC pre-send guard ─────────────────────────────────────────
  // US carriers hard-drop A2P traffic from unregistered long codes (err 30034).
  // Allow when: MessagingServiceSid set, sender is a verified toll-free, or
  // TWILIO_A2P_BYPASS=true.
  const a2pBypass = Deno.env.get("TWILIO_A2P_BYPASS") === "true";
  const isUsDestination = to.startsWith("+1");
  const senderIsTollFree = isUsTollFree(from);
  if (isUsDestination && !messagingServiceSid && !senderIsTollFree && !a2pBypass) {
    const msg =
      `A2P_UNREGISTERED: Number ${from} not registered for A2P 10DLC — message to ${to} NOT sent. ` +
      `US carriers will silently drop (Twilio error 30034). Register a Brand + Campaign, attach the ` +
      `number to a Messaging Service, then set TWILIO_MESSAGING_SERVICE_SID. ` +
      `Or send From a verified toll-free (+1 800/833/844/855/866/877/888). ` +
      `Set TWILIO_A2P_BYPASS=true only for verified test numbers.`;
    console.error(`🚫 ${msg}`);
    return { success: false, error_code: "A2P_UNREGISTERED", error_message: msg };
  }
  if (senderIsTollFree && !messagingServiceSid) {
    console.log(`✅ Toll-free sender ${from} → bypassing A2P 10DLC guard`);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams();
  form.append("To", to);
  if (messagingServiceSid) form.append("MessagingServiceSid", messagingServiceSid);
  else form.append("From", from);
  form.append("Body", body);

  // C5 STANDARD: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN is the canonical pair.
  // The TWILIO_API_SID/TWILIO_API_SECRET ("connector" key) path is DEPRECATED
  // and kept only as a legacy fallback for accounts still rotating off the
  // restricted-key UI. New deployments should set only ACCOUNT_SID + AUTH_TOKEN.
  const authCandidates: Array<{ label: string; value: string }> = [];
  if (token) authCandidates.push({ label: "account_token", value: btoa(`${sid}:${token}`) });
  if (apiSid && apiSecret) authCandidates.push({ label: "api_key_legacy", value: btoa(`${apiSid}:${apiSecret}`) });

  try {
    let lastFailure: ProviderResult | null = null;

    for (const auth of authCandidates) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth.value}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        // Twilio accepted the request, but the Message resource may already
        // carry an error_code (e.g. queued+30007, undelivered+30034). Surface
        // it so the caller can show the partial-success status to operators.
        const partialError = data?.error_code ? String(data.error_code) : null;
        const partialMsg = data?.error_message || null;
        return {
          success: true,
          provider_message_id: data.sid,
          error_code: partialError ?? undefined,
          error_message: partialMsg ?? undefined,
          raw_response: { ...data, auth_mode: auth.label },
        };
      }

      lastFailure = {
        success: false,
        error_code: String(data.code || res.status),
        error_message: data.message || "Twilio error",
        raw_response: { ...data, auth_mode: auth.label },
      };

      if (!(res.status === 401 || data?.code === 20003)) {
        return lastFailure;
      }
    }

    return lastFailure || { success: false, error_code: "TWILIO_UNKNOWN", error_message: "Twilio send failed" };
  } catch (e: any) {
    return { success: false, error_code: "NETWORK", error_message: e.message };
  }
}

async function sendViaBizText(to: string, body: string): Promise<ProviderResult> {
  const wid = Deno.env.get("BIZTEXT_WEBSITE_ID") || "438";
  // Normalize to 10 digits for BizText
  let digits = to.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) digits = digits.substring(1);
  if (digits.length !== 10) {
    return { success: false, error_code: "INVALID_PHONE", error_message: `BizText requires 10 digits, got ${digits.length}` };
  }

  const params = new URLSearchParams({ to: `+1${digits}`, txt: body, wid });
  const url = `https://www.biztextsolutions.com/api/send?${params.toString()}`;

  try {
    console.log(`📡 BizText API call: POST ${url.replace(/txt=[^&]+/, 'txt=[REDACTED]')}`);
    const res = await fetch(url, { method: "POST" });
    const text = await res.text();
    console.log(`📡 BizText response status: ${res.status}, body: ${text.substring(0, 500)}`);
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw_response: text.trim() }; }

    // Only flag as error on clear failure signals — not substring matches
    const isError = !res.ok || data?.error === true || data?.auth === false;

    if (isError) {
      console.error(`❌ BizText API error: status=${res.status} body=${text.substring(0, 300)}`);
      return { success: false, error_code: String(res.status), error_message: text.substring(0, 300), raw_response: data };
    }
    return { success: true, provider_message_id: data?.message_id || data?.id || null, raw_response: data };
  } catch (e: any) {
    console.error(`❌ BizText network error: ${e.message}`);
    return { success: false, error_code: "NETWORK", error_message: e.message };
  }
}

interface ProviderResult {
  success: boolean;
  provider_message_id?: string | null;
  error_code?: string;
  error_message?: string;
  raw_response?: any;
}

/**
 * Message class. MANDATORY — there is no default, by design.
 * A function that lands in the wrong bucket should fail to compile / fail at
 * the door, not send silently under someone else's budget.
 *   transactional  — customer-initiated (receipts, confirmations, codes)
 *   workforce      — contracted staff / partner dispatch
 *   conversational — 1:1 human-initiated rep→customer message
 *   campaign       — marketing / outreach (suppression + cooldown + caps)
 * internal / test never come through here; they use _shared/twilioSend.ts.
 */
type SendClass = "transactional" | "workforce" | "conversational" | "campaign";
const VALID_CLASSES: SendClass[] = ["transactional", "workforce", "conversational", "campaign"];

interface SendRequest {
  to_number: string;
  message_body: string;
  idempotency_key: string;
  /** REQUIRED. See SendClass. */
  send_class: SendClass;
  store_id?: string;
  campaign_id?: string;
  /** Recipient count the campaign was created with — becomes its hard ceiling. */
  campaign_max_sends?: number;
  explicit_provider?: "twilio" | "biztext";
  skip_cooldown?: boolean;
  metadata?: Record<string, any>;
  from_number?: string;
  /** Purpose tag used for analytics, dashboards, and downstream routing */
  /** Examples: "manual", "bland_outreach", "relay_toptier", "bulk_blast", "ambassador", "approval" */
  purpose?: string;
  /** Optional template identifier — purely metadata, the caller pre-renders message_body */
  template_id?: string;
}


// ── Helpers ────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("09") && d.length === 11) d = `63${d.substring(1)}`;
  if (d.startsWith("63") && d.length === 12) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (!d.startsWith("+")) return `+${d}`;
  return d;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Main Handler ───────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── 1. Parse & Validate ──────────────────────────────────────────
    const body: SendRequest = await req.json();
    const { to_number, message_body, idempotency_key, send_class, store_id, campaign_id, campaign_max_sends, explicit_provider, skip_cooldown, metadata, from_number, purpose, template_id } = body;
    const fromOverride = from_number ? normalizePhone(from_number) : undefined;
    // Merge purpose/template_id into metadata so downstream analytics see them
    const enrichedMetadata: Record<string, any> = {
      ...(metadata || {}),
      ...(purpose ? { purpose } : {}),
      ...(template_id ? { template_id } : {}),
    };

    if (!to_number || !message_body || !idempotency_key) {
      return respond(400, { error: "Missing required fields: to_number, message_body, idempotency_key" });
    }

    // send_class is mandatory and has NO default. A caller that doesn't say
    // what kind of message this is doesn't get to send it.
    if (!send_class || !VALID_CLASSES.includes(send_class)) {
      return respond(400, {
        error: `send_class is required and must be one of: ${VALID_CLASSES.join(", ")}. ` +
               `internal/test traffic must use _shared/twilioSend.ts, not send-sms.`,
        status: "missing_send_class",
      });
    }

    if (message_body.length > 1600) {
      return respond(400, { error: "message_body exceeds 1600 character limit" });
    }

    const formattedTo = normalizePhone(to_number);

    // ── 2. Load class config ─────────────────────────────────────────
    const { data: classCfg, error: classErr } = await supabase
      .from("messaging_class_limits")
      .select("*")
      .eq("send_class", send_class)
      .maybeSingle();

    if (classErr || !classCfg) {
      return respond(500, { error: `Unknown or unreadable send_class '${send_class}'`, status: "config_error" });
    }
    if (classCfg.enabled === false) {
      return respond(429, { error: `send_class '${send_class}' is disabled`, status: "class_disabled" });
    }

    // ── 3. Suppression ───────────────────────────────────────────────
    // Legal STOP is absolute for EVERY class that reaches send-sms — one
    // function, called once. Marketing suppression is class-scoped on top.
    const stop = await legalStopBlocked(supabase, formattedTo);
    let suppression: { blocked: boolean; reason?: string | null; source?: string | null } =
      stop.blocked ? { blocked: true, reason: stop.reason, source: "legal_stop" } : { blocked: false };

    if (!suppression.blocked && classCfg.suppression_check) {
      const s = await isSuppressed(supabase, formattedTo);
      if (s.blocked) suppression = { blocked: true, reason: s.reason, source: s.source };
    }

    if (suppression.blocked) {
      // Log blocked attempt
      await supabase.from("outbound_messages").insert({
        idempotency_key,
        to_number: formattedTo,
        message_body,
        send_class,
        provider: explicit_provider || "biztext",
        status: "blocked",
        error_message: `Suppressed (${suppression.source || "unknown"}): ${suppression.reason || "blocked"}`,
        store_id: store_id || null,
        campaign_id: campaign_id || null,
        metadata: { ...enrichedMetadata, suppression_source: suppression.source || null },
      });
      return respond(200, {
        success: false,
        status: "blocked",
        reason: suppression.reason || "opted_out",
        source: suppression.source,
      });
    }

    // ── 4. Idempotency Check ─────────────────────────────────────────
    const { data: existing } = await supabase
      .from("outbound_messages")
      .select("*")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existing) {
      console.log(`♻️ Idempotent hit: ${idempotency_key} → ${existing.status}`);
      return respond(200, {
        success: existing.status === "sent",
        status: existing.status,
        message_id: existing.id,
        provider_message_id: existing.provider_message_id,
        idempotent: true,
      });
    }

    // ── 5. Provider settings (limits now live per-class) ─────────────
    const { data: settings } = await supabase
      .from("messaging_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const defaultProvider = settings?.default_sms_provider ?? "biztext";
    const fallbackProvider = settings?.fallback_provider ?? null;

    // ── 6. Class-scoped cooldown ─────────────────────────────────────
    // A campaign text can no longer block that customer's receipt: the
    // cooldown only looks at prior traffic of the SAME class.
    if (!skip_cooldown && classCfg.cooldown_scope === "class" && (classCfg.cooldown_minutes ?? 0) > 0) {
      const { data: cdActive } = await supabase.rpc("sms_cooldown_active", {
        p_send_class: send_class,
        p_to_number: formattedTo,
      });
      if (cdActive === true) {
        return respond(429, {
          error: `Cooldown active: last ${send_class} message to ${formattedTo} within ${classCfg.cooldown_minutes} minutes`,
          status: "cooldown",
          send_class,
        });
      }
    }

    // ── 7. Atomic reservation (the claim, not a read-then-act check) ──
    const { data: reservation, error: reserveErr } = await supabase.rpc("reserve_sms_send", {
      p_send_class: send_class,
      p_campaign_id: campaign_id || null,
      p_campaign_max: campaign_max_sends ?? null,
    });

    if (reserveErr) {
      console.error("❌ reserve_sms_send failed:", reserveErr.message);
      return respond(500, { error: `Reservation failed: ${reserveErr.message}`, status: "reservation_error" });
    }
    if (!reservation?.allowed) {
      console.warn(`⛔ Send refused: ${reservation?.reason} (class=${send_class} campaign=${campaign_id ?? "none"})`);
      return respond(429, {
        error: reservation?.reason === "campaign_cap_reached"
          ? `Campaign ${campaign_id} has reached its recipient-count ceiling`
          : `Daily limit for class '${send_class}' reached (${reservation?.daily_limit ?? "?"})`,
        status: "rate_limited",
        reason: reservation?.reason,
        send_class,
      });
    }
    const releaseReservation = async () => {
      await supabase.rpc("release_sms_reservation", {
        p_send_class: send_class,
        p_campaign_id: campaign_id || null,
      });
    };


    // ── 8. Message Hash (Duplicate content detection) ────────────────
    const msgHash = await sha256Hex(formattedTo + message_body);
    const hashCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: hashDup } = await supabase
      .from("outbound_messages")
      .select("id")
      .eq("message_hash", msgHash)
      .gte("created_at", hashCutoff)
      .in("status", ["sent", "pending"])
      .limit(1);

    if (hashDup && hashDup.length > 0) {
      await releaseReservation();
      return respond(409, {
        error: "Duplicate message detected within 10-minute window",
        status: "duplicate",
      });
    }

    // ── 9. Resolve Provider ──────────────────────────────────────────
    const chosenProvider: "twilio" | "biztext" = explicit_provider || (defaultProvider as "twilio" | "biztext");

    // ── 10. Insert Pending Row ───────────────────────────────────────
    // Extract created_by from auth header if available
    let createdBy: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (anonKey) {
        const authClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await authClient.auth.getUser();
        createdBy = user?.id ?? null;
      }
    }

    const costEstimate = chosenProvider === "twilio" ? 0.0079 : 0.005;

    const { data: pendingRow, error: insertErr } = await supabase
      .from("outbound_messages")
      .insert({
        idempotency_key,
        to_number: formattedTo,
        message_body,
        send_class,
        provider: chosenProvider,
        status: "pending",
        store_id: store_id || null,
        campaign_id: campaign_id || null,
        message_hash: msgHash,
        created_by: createdBy,
        metadata: {
          ...enrichedMetadata,
          cost_estimate: costEstimate,
          reservation: reservation,
          provider_rate: chosenProvider === "twilio" ? "twilio_standard" : "biztext_standard",
        },
      })
      .select()
      .single();

    if (insertErr) {
      console.error("❌ Insert pending row failed:", insertErr);
      await releaseReservation();
      return respond(500, { error: insertErr.message });
    }


    console.log(`📱 Sending SMS via ${chosenProvider} to ${formattedTo} [${pendingRow.id}]`);

    // ── 10. Call Provider ────────────────────────────────────────────
    let result: ProviderResult;
    if (chosenProvider === "twilio") {
      result = await sendViaTwilio(formattedTo, message_body, fromOverride);
    } else {
      result = await sendViaBizText(formattedTo, message_body);
    }

    // ── 11. Fallback on Failure ──────────────────────────────────────
    let actualProviderUsed: "twilio" | "biztext" = chosenProvider;

    if (!result.success && fallbackProvider && fallbackProvider !== chosenProvider) {
      console.log(`⚠️ Primary ${chosenProvider} failed, falling back to ${fallbackProvider}`);
      if (fallbackProvider === "twilio") {
        result = await sendViaTwilio(formattedTo, message_body, fromOverride);
      } else {
        result = await sendViaBizText(formattedTo, message_body);
      }
      actualProviderUsed = fallbackProvider as "twilio" | "biztext";

      if (result.success) {
        // Update provider to reflect fallback used
        await supabase
          .from("outbound_messages")
          .update({ provider: fallbackProvider as any })
          .eq("id", pendingRow.id);
      }
    }

    // ── 12. Update Row ───────────────────────────────────────────────
    if (result.success) {
      const partialStatus = result.error_code ? "queued" : "sent";
      await supabase
        .from("outbound_messages")
        .update({
          status: partialStatus,
          provider_message_id: result.provider_message_id || null,
          sent_at: new Date().toISOString(),
          error_code: result.error_code || null,
          error_message: result.error_message || null,
          metadata: {
            ...pendingRow.metadata,
            raw_response: result.raw_response,
          },
        })
        .eq("id", pendingRow.id);

      console.log(`✅ SMS accepted: ${pendingRow.id} status=${partialStatus} error_code=${result.error_code ?? "none"}`);
      return respond(200, {
        success: true,
        status: partialStatus,
        message_id: pendingRow.id,
        provider: actualProviderUsed,
        provider_message_id: result.provider_message_id,
        error_code: result.error_code || null,
        error_message: result.error_message || null,
      });
    } else {
      await supabase
        .from("outbound_messages")
        .update({
          status: "failed",
          error_code: result.error_code || null,
          error_message: result.error_message || null,
          metadata: {
            ...pendingRow.metadata,
            raw_response: result.raw_response,
          },
        })
        .eq("id", pendingRow.id);

      // The provider refused it, so it never consumed budget — give the slot back.
      await releaseReservation();

      console.error(`❌ SMS failed: ${result.error_message}`);
      return respond(500, {
        success: false,
        status: "failed",
        message_id: pendingRow.id,
        error_code: result.error_code,
        error_message: result.error_message,
      });
    }
  } catch (error: any) {
    console.error("❌ Unhandled error in send-sms:", error);
    return respond(500, { error: error.message });
  }
});

function respond(status: number, body: any): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
