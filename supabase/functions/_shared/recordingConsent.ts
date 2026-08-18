// Canonical recording-consent gate.
//
// Rule: we record a call ONLY when the recipient's jurisdiction is known AND
// that state is one-party consent. Unknown jurisdiction, all-party states, and
// 'prohibited' all fail CLOSED (no recording). Area code is never a source of
// jurisdiction here — it is a routing hint, not a legal fact.
//
// Jurisdiction comes from public.resolve_recording_consent(phone), which reads
// the zip-derived derived_state on the lead. See
// mem://comms/recording-consent-gate-prerequisite.

export type ConsentRule = "one_party" | "all_party" | "prohibited" | "unknown";

export interface ConsentDecision {
  /** true only when recording is permitted without an announcement */
  allowed: boolean;
  rule: ConsentRule;
  state: string | null;
  timezone: string | null;
  contested: boolean;
  /** where the jurisdiction came from: 'zip' | 'state_text' | null */
  source: string | null;
  reason: string;
}

const DENY = (reason: string, extra: Partial<ConsentDecision> = {}): ConsentDecision => ({
  allowed: false,
  rule: "unknown",
  state: null,
  timezone: null,
  contested: false,
  source: null,
  reason,
  ...extra,
});

/**
 * Resolve whether we may record a call with this counterparty.
 * Any error, missing phone, or unresolved jurisdiction => no recording.
 */
export async function getRecordingConsent(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  phone: string | null | undefined,
): Promise<ConsentDecision> {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return DENY("no_usable_phone");

  try {
    const { data, error } = await supabase.rpc("resolve_recording_consent", { p_phone: digits });
    if (error) {
      console.error("[recordingConsent] rpc error, failing closed:", (error as { message?: string })?.message ?? error);
      return DENY("rpc_error");
    }
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | undefined);
    if (!row || !row.state) return DENY("jurisdiction_unresolved");

    const rule = (row.consent_rule as ConsentRule) ?? "unknown";
    const base = {
      rule,
      state: (row.state as string) ?? null,
      timezone: (row.timezone as string) ?? null,
      contested: Boolean(row.contested),
      source: (row.source as string) ?? null,
    };
    if (rule === "one_party") {
      return { ...base, allowed: true, reason: "one_party_state" };
    }
    return { ...base, allowed: false, reason: rule === "unknown" ? "no_policy_for_state" : `${rule}_state` };
  } catch (e) {
    console.error("[recordingConsent] threw, failing closed:", e instanceof Error ? e.message : String(e));
    return DENY("exception");
  }
}

export interface RecordAttrOptions {
  /** 'record-from-answer-dual' (default) or 'record-from-answer' */
  mode?: "record-from-answer-dual" | "record-from-answer" | "record-from-start";
  /** optional recordingStatusCallback URL, only emitted when recording is allowed */
  callbackUrl?: string;
  callbackEvent?: string;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Build the `record="..."` TwiML attribute fragment (leading space included),
 * or an empty string when recording is not permitted.
 */
export function recordAttr(decision: ConsentDecision, opts: RecordAttrOptions = {}): string {
  if (!decision.allowed) return "";
  const mode = opts.mode ?? "record-from-answer-dual";
  let attr = ` record="${mode}"`;
  if (opts.callbackUrl) {
    attr += ` recordingStatusCallback="${escapeXml(opts.callbackUrl)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="${opts.callbackEvent ?? "completed"}"`;
  }
  return attr;
}

/** Convenience: resolve + render in one call. */
export async function recordAttrFor(
  supabase: Parameters<typeof getRecordingConsent>[0],
  phone: string | null | undefined,
  opts: RecordAttrOptions = {},
): Promise<{ attr: string; decision: ConsentDecision }> {
  const decision = await getRecordingConsent(supabase, phone);
  if (!decision.allowed) {
    console.log(`[recordingConsent] recording suppressed (${decision.reason}${decision.state ? `, ${decision.state}` : ""})`);
  }
  return { attr: recordAttr(decision, opts), decision };
}
