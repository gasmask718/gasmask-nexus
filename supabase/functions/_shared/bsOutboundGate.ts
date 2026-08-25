/**
 * BrightSun Solar — single outbound enforcement point.
 *
 * SCOPE: BrightSun Solar Hub only. Shared core helpers (`_shared/dnc.ts`,
 * `_shared/twilioSend.ts`) are consumed READ-ONLY — nothing in them is
 * modified by this module.
 *
 * Every BrightSun path capable of initiating outbound voice or SMS must call
 * `bsOutboundGate()` and must abort when `allowed === false`. Voice paths must
 * ALSO route their Twilio `Url` through the `bs-outbound-gate` edge function so
 * the decision is re-made TwiML-side, immediately before any audio is produced.
 *
 * Every check FAILS CLOSED: a lookup error, a missing table, a missing state,
 * or a missing consent artifact all refuse the attempt.
 */
import { isSuppressed, normalizeE164, phoneLast10 } from "./dnc.ts";
import { legalStopBlocked } from "./twilioSend.ts";

/** Encode a downstream TwiML URL for transport in the bs-outbound-gate URL. */
export function encodeTarget(url: string): string {
  return btoa(url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Inverse of `encodeTarget`. Returns null when the value is not decodable. */
export function decodeTarget(v: string): string | null {
  try {
    const b64 = v.replace(/-/g, "+").replace(/_/g, "/");
    return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  } catch {
    return null;
  }
}

export type BsChannel = "voice" | "sms";

export type BsGateReason =
  | "allowed"
  | "invalid_phone"
  | "suppressed"
  | "legal_stop"
  | "geo_policy_missing"
  | "geo_blocked"
  | "geo_gate_uncleared"
  | "lead_state_unknown"
  | "no_consent_artifact"
  | "consent_expired"
  | "consent_revoked"
  | "gate_error";

export interface BsGateInput {
  supabase: any;
  phone: string;
  /** Two-letter state of the lead/contact. Unknown state = refusal. */
  state?: string | null;
  channel: BsChannel;
  /** Name of the function asking (logged verbatim on refusal). */
  caller: string;
  leadId?: string | null;
  contactId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface BsGateResult {
  allowed: boolean;
  reasonCode: BsGateReason;
  detail?: string;
  phoneE164?: string;
}

/** Log a refusal. Never throws — a logging failure must not un-refuse a call. */
export async function logBsRefusal(
  supabase: any,
  input: BsGateInput,
  result: BsGateResult,
): Promise<void> {
  try {
    await supabase.from("bs_outbound_refusals").insert({
      caller_function: input.caller,
      channel: input.channel,
      reason_code: result.reasonCode,
      reason_detail: result.detail ?? null,
      phone: result.phoneE164 ?? input.phone ?? null,
      phone_last10: phoneLast10(input.phone) || null,
      lead_state: input.state ?? null,
      lead_id: input.leadId ?? null,
      contact_id: input.contactId ?? null,
      metadata: (input.metadata ?? {}) as Record<string, unknown>,
    });
  } catch (e) {
    console.error(`[bsOutboundGate] refusal log failed (${input.caller}):`, e);
  }
}

async function geoAllowed(
  supabase: any,
  state: string,
): Promise<BsGateResult | null> {
  try {
    const { data, error } = await supabase
      .from("bs_geo_policy")
      .select("outbound_allowed, blocking_gate, gate_cleared_at")
      .eq("state", state)
      .maybeSingle();
    if (error) {
      // Table does not exist yet (it lands in a later migration) or the read
      // failed. Either way: no policy = no permission.
      return {
        allowed: false,
        reasonCode: "geo_policy_missing",
        detail: `bs_geo_policy unreadable for ${state}: ${error.message}`,
      };
    }
    if (!data) {
      return {
        allowed: false,
        reasonCode: "geo_policy_missing",
        detail: `no bs_geo_policy row for ${state}`,
      };
    }
    if (data.outbound_allowed !== true) {
      return { allowed: false, reasonCode: "geo_blocked", detail: `${state} outbound_allowed=false` };
    }
    if (data.blocking_gate && !data.gate_cleared_at) {
      return {
        allowed: false,
        reasonCode: "geo_gate_uncleared",
        detail: `${state} blocked by ${data.blocking_gate}`,
      };
    }
    return null;
  } catch (e) {
    return { allowed: false, reasonCode: "geo_policy_missing", detail: String(e) };
  }
}

async function consentOk(
  supabase: any,
  last10: string,
): Promise<BsGateResult | null> {
  try {
    const { data, error } = await supabase
      .from("bs_consent_artifacts")
      .select("id, expires_at, revoked_at")
      .eq("phone_last10", last10)
      .order("captured_at", { ascending: false })
      .limit(5);
    if (error) {
      return { allowed: false, reasonCode: "gate_error", detail: `consent lookup: ${error.message}` };
    }
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return { allowed: false, reasonCode: "no_consent_artifact", detail: "no consent artifact on file" };
    }
    const now = Date.now();
    const live = rows.find((r: any) =>
      !r.revoked_at && (!r.expires_at || new Date(r.expires_at).getTime() > now)
    );
    if (!live) {
      const revoked = rows.some((r: any) => r.revoked_at);
      return {
        allowed: false,
        reasonCode: revoked ? "consent_revoked" : "consent_expired",
        detail: revoked ? "consent revoked" : "consent expired",
      };
    }
    return null;
  } catch (e) {
    return { allowed: false, reasonCode: "gate_error", detail: String(e) };
  }
}

/**
 * THE enforcement point. Returns `{ allowed: false }` on any failure and has
 * already written the refusal row before returning.
 */
export async function bsOutboundGate(input: BsGateInput): Promise<BsGateResult> {
  const { supabase, phone, channel, caller } = input;

  const refuse = async (r: BsGateResult): Promise<BsGateResult> => {
    console.warn(
      `[bs-gate] REFUSED ${channel} from ${caller}: ${r.reasonCode}${r.detail ? ` — ${r.detail}` : ""}`,
    );
    await logBsRefusal(supabase, input, r);
    return r;
  };

  try {
    const e164 = normalizeE164(phone);
    const last10 = phoneLast10(phone);
    if (!e164 || !last10) {
      return await refuse({ allowed: false, reasonCode: "invalid_phone", detail: String(phone ?? "") });
    }

    // 1) Suppression (dnc_list + opt_out_events, last-10 matched, fails closed).
    const sup = await isSuppressed(supabase, e164);
    if (sup.blocked) {
      return await refuse({
        allowed: false,
        reasonCode: "suppressed",
        detail: `${sup.source ?? "suppression"}: ${sup.reason ?? "blocked"}`,
        phoneE164: e164,
      });
    }

    // 2) Legal STOP — class-agnostic, one number for the whole account.
    const stop = await legalStopBlocked(supabase, e164);
    if (stop.blocked) {
      return await refuse({
        allowed: false,
        reasonCode: "legal_stop",
        detail: stop.reason,
        phoneE164: e164,
      });
    }

    // 3) Jurisdiction. No state on the lead = no jurisdiction = refuse.
    const state = (input.state || "").trim().toUpperCase();
    if (!state || state.length !== 2) {
      return await refuse({
        allowed: false,
        reasonCode: "lead_state_unknown",
        detail: `state="${input.state ?? ""}"`,
        phoneE164: e164,
      });
    }
    const geo = await geoAllowed(supabase, state);
    if (geo) return await refuse({ ...geo, phoneE164: e164 });

    // 4) Consent artifact.
    const consent = await consentOk(supabase, last10);
    if (consent) return await refuse({ ...consent, phoneE164: e164 });

    return { allowed: true, reasonCode: "allowed", phoneE164: e164 };
  } catch (e) {
    return await refuse({ allowed: false, reasonCode: "gate_error", detail: String(e) });
  }
}
