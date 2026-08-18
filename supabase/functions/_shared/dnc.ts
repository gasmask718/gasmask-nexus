// Shared DNC enforcement + disposition helpers for Dynasty Connect edge functions.
// Keep dependency-free — uses fetch + supabase REST so it works under any client.

/**
 * ONE normalization function, used by every suppression read AND write.
 *
 * dnc_list stores E.164 ("+17189222137"); lead tables store display format
 * ("(347) 201-6324"). An exact string comparison between those never matches,
 * so a DNC check written that way passes code review and cannot ever fire.
 * Rather than pick a format and migrate ~1,900 lead rows, we normalize at both
 * ends: dnc_list.phone_last10 / opt_out_events.phone_last10 are generated
 * columns holding the same last-10 key this function produces.
 */
export function phoneLast10(raw: string | null | undefined): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}

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

  // NOTE: we deliberately use .in() rather than .or() here. PostgREST `or=`
  // filter strings are sent raw, so the leading "+" in an E.164 number decodes
  // as a space and the match silently misses. .in() values are URL-encoded.
  const last10 = phoneLast10(phone);
  const digits = e164.replace(/\D/g, "");
  const variants = Array.from(new Set([e164, digits, String(phone || "")].filter(Boolean)));

  try {
    // Canonical key first — matches regardless of stored format.
    if (last10) {
      const { data, error } = await supabase
        .from("dnc_list")
        .select("reason")
        .eq("phone_last10", last10)
        .limit(1);
      if (error) throw error;
      const hit = Array.isArray(data) ? data[0] : data;
      if (hit) return { blocked: true, reason: hit.reason || "dnc_list" };
    }
    for (const col of ["phone_e164", "phone_number"]) {
      const { data, error } = await supabase
        .from("dnc_list")
        .select("reason")
        .in(col, variants)
        .limit(1);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) return { blocked: true, reason: row.reason || "dnc_list" };
    }
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
// isOnDNC() above keeps its original signature and return shape (GasMask /
// dd- / tt- / dc-* functions depend on it) and now uses the same encoded
// .in() lookup pattern; it checks dnc_list only.
// ---------------------------------------------------------------------------
export async function isSuppressed(
  supabase: any,
  phone: string,
): Promise<{ blocked: boolean; reason?: string; source?: "dnc_list" | "opt_out_events" }> {
  const e164 = normalizeE164(phone);
  if (!e164) return { blocked: false };
  const digits = e164.replace(/\D/g, "");
  const last10 = phoneLast10(phone);

  // NOTE: we deliberately use .in() rather than .or() here. PostgREST `or=`
  // filter strings are sent raw, so a leading "+" decodes as a space and an
  // E.164 match silently misses. .in() values are properly URL-encoded.
  const variants = Array.from(new Set([e164, digits, String(phone || "")].filter(Boolean)));

  // 1) dnc_list — canonical last-10 key first, then the legacy exact columns
  //    (older rows predate the generated column backfill only in theory —
  //    generated columns backfill on add — but the exact match is cheap).
  try {
    if (last10) {
      const { data, error } = await supabase
        .from("dnc_list")
        .select("reason")
        .eq("phone_last10", last10)
        .limit(1);
      if (error) throw error;
      const hit = Array.isArray(data) ? data[0] : data;
      if (hit) {
        return { blocked: true, reason: hit.reason || "dnc_list", source: "dnc_list" };
      }
    }
    for (const col of ["phone_e164", "phone_number"]) {
      const { data, error } = await supabase
        .from("dnc_list")
        .select("reason")
        .in(col, variants)
        .limit(1);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        return { blocked: true, reason: row.reason || "dnc_list", source: "dnc_list" };
      }
    }
  } catch (_e) {
    // Fail CLOSED for compliance, matching isOnDNC.
    return { blocked: true, reason: "suppression_lookup_failed", source: "dnc_list" };
  }

  // 2) opt_out_events — canonical last-10 key, then legacy exact variants.
  try {
    if (last10) {
      const { data, error } = await supabase
        .from("opt_out_events")
        .select("id")
        .eq("phone_last10", last10)
        .limit(1);
      if (error) throw error;
      const hit = Array.isArray(data) ? data[0] : data;
      if (hit) return { blocked: true, reason: "opted_out", source: "opt_out_events" };
    }
    const { data, error } = await supabase
      .from("opt_out_events")
      .select("id")
      .in("phone_number", variants)
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      return { blocked: true, reason: "opted_out", source: "opt_out_events" };
    }
  } catch (_e) {
    return { blocked: true, reason: "suppression_lookup_failed", source: "opt_out_events" };
  }


  return { blocked: false };
}
