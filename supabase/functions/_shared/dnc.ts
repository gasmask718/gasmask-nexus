// Shared DNC enforcement + disposition helpers for Dynasty Connect edge functions.
// Keep dependency-free — uses fetch + supabase REST so it works under any client.

export function normalizeE164(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = String(raw).replace(/\D/g, "");
  if (d.length === 10) d = `1${d}`;
  return d ? `+${d}` : "";
}

/**
 * Returns true if the given phone is on the DNC list.
 * Checks the normalized phone_e164 column AND the legacy phone_number column
 * (so newly added rows or older un-backfilled rows still block dials).
 */
export async function isOnDNC(
  supabase: any,
  phone: string,
): Promise<{ blocked: boolean; reason?: string }> {
  const e164 = normalizeE164(phone);
  if (!e164) return { blocked: false };

  try {
    const { data } = await supabase
      .from("dnc_list")
      .select("reason, phone_e164, phone_number")
      .or(`phone_e164.eq.${e164},phone_number.eq.${e164},phone_number.eq.${phone}`)
      .limit(1)
      .maybeSingle();
    if (data) return { blocked: true, reason: data.reason || "dnc_list" };
  } catch (_e) {
    // Fail-open is unacceptable for compliance — fail-CLOSED on lookup error.
    return { blocked: true, reason: "dnc_lookup_failed" };
  }
  return { blocked: false };
}

// ----- Canonical disposition codes -----
// Source of truth lives in public.dc_disposition_codes. This list MUST be kept
// in sync with the seed data in the migration that created that table.
export const CANONICAL_DISPOSITIONS = new Set([
  "new",
  "queued",
  "called",
  "voicemail",
  "no_answer",
  "callback",
  "interested",
  "booked",
  "not_interested",
  "wrong_number",
  "dnc",
]);

// Map free-form / legacy disposition strings → canonical code.
// Anything not recognized falls back to "called" with a console warning.
const DISPOSITION_ALIASES: Record<string, string> = {
  // legacy hyphenated UI form
  "not-interested": "not_interested",
  // SF / RE legacy values
  do_not_call: "dnc",
  do_not_contact: "dnc",
  dnc: "dnc",
  // bland statuses
  completed: "called",
  in_progress: "called",
  busy: "no_answer",
  failed: "no_answer",
  no_answer: "no_answer",
  voicemail: "voicemail",
  // positive
  interested: "interested",
  booked: "booked",
  appointment_set: "booked",
  callback: "callback",
  wrong_number: "wrong_number",
};

export function canonicalizeDisposition(raw: string | null | undefined): string {
  if (!raw) return "called";
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (CANONICAL_DISPOSITIONS.has(key)) return key;
  const aliased = DISPOSITION_ALIASES[key];
  if (aliased && CANONICAL_DISPOSITIONS.has(aliased)) return aliased;
  console.warn(`[disposition] unrecognized code "${raw}" → defaulting to "called"`);
  return "called";
}

// ---------------------------------------------------------------------------
// UNIFIED SUPPRESSION CHECK (UT-025)
// `dnc_list` (voice-side) and `opt_out_events` (SMS-side) are two separate
// suppression sources that were never cross-checked. isSuppressed() checks BOTH.
// isOnDNC() above is intentionally left untouched — GasMask / dd- / tt- / dc-*
// functions depend on its exact behaviour.
// ---------------------------------------------------------------------------
export async function isSuppressed(
  supabase: any,
  phone: string,
): Promise<{ blocked: boolean; reason?: string; source?: "dnc_list" | "opt_out_events" }> {
  const e164 = normalizeE164(phone);
  if (!e164) return { blocked: false };
  const digits = e164.replace(/\D/g, "");

  // 1) dnc_list — same OR-shape as isOnDNC (normalized + legacy + raw).
  try {
    const { data } = await supabase
      .from("dnc_list")
      .select("reason, phone_e164, phone_number")
      .or(`phone_e164.eq.${e164},phone_number.eq.${e164},phone_number.eq.${phone}`)
      .limit(1)
      .maybeSingle();
    if (data) {
      return { blocked: true, reason: data.reason || "dnc_list", source: "dnc_list" };
    }
  } catch (_e) {
    // Fail CLOSED for compliance, matching isOnDNC.
    return { blocked: true, reason: "suppression_lookup_failed", source: "dnc_list" };
  }

  // 2) opt_out_events — stores digits-only phone_number (see send-sms).
  try {
    const { data } = await supabase
      .from("opt_out_events")
      .select("id")
      .or(`phone_number.eq.${digits},phone_number.eq.${e164}`)
      .limit(1)
      .maybeSingle();
    if (data) {
      return { blocked: true, reason: "opted_out", source: "opt_out_events" };
    }
  } catch (_e) {
    return { blocked: true, reason: "suppression_lookup_failed", source: "opt_out_events" };
  }

  return { blocked: false };
}
