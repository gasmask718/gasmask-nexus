/**
 * Canonical capper-identity gate (Stage 3 — "Resolve vs Create" split).
 *
 * Root cause this fixes: both intake paths treated "did not resolve" as
 * "therefore create". Any text line the extractor grabbed — a date heading
 * ("August 4th VIP"), a weekday ("Friday"), a matchup line, a system label —
 * became a permanent capper row. 31 junk identities were created that way.
 *
 * The split:
 *   RESOLVE  — unchanged, still permissive. Matching an existing capper is
 *              always safe, so nothing here touches the lookup path.
 *   CREATE   — now gated. A brand-new identity requires ALL of:
 *              (A) a human-shaped name,
 *              (B) extraction confidence >= MIN_CREATE_CONFIDENCE,
 *              (B5) a SECOND SIGHTING — the same normalized name must appear
 *                   on two DISTINCT source messages before a row is created.
 *
 * B5 is the load-bearing rule. Nearly every junk identity was a one-off text
 * artifact; a real capper posts more than once. First sighting is parked in
 * sbo_pending_capper_identities instead of sbo_cappers, so nothing is lost —
 * the candidate is visible and auditable, it just isn't yet an identity.
 *
 * IMPORTANT: never inline these rules at a call site. Both sbo-auto-capper and
 * sbo-parse-capper-image import from here so the two intake paths cannot drift.
 */

/** Confidence floor for minting a brand-new identity (resolution is unaffected). */
export const MIN_CREATE_CONFIDENCE = 85;

/** Distinct source messages a name must appear on before it becomes a capper. */
export const REQUIRED_SIGHTINGS = 2;

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const WEEKDAYS =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun";

/** Labels that are pipeline/system artifacts, never a person. */
const SYSTEM_WORDS = [
  "system",
  "system picks",
  "picks",
  "pick",
  "plays",
  "play",
  "vip",
  "free",
  "premium",
  "lock",
  "locks",
  "today",
  "tonight",
  "tomorrow",
  "yesterday",
  "slate",
  "card",
  "board",
  "parlay",
  "unknown",
  "unknown capper",
  "empire",
];

export interface NameShapeResult {
  ok: boolean;
  /** Machine-readable rejection reason; null when ok. */
  reason: string | null;
}

/**
 * Is this string plausibly a PERSON/BRAND name rather than a date, a matchup,
 * a heading, or a system label?
 *
 * Deliberately conservative: a false reject only means the candidate waits in
 * the pending table (and can be promoted by hand), whereas a false accept
 * creates permanent junk that then fragments pick attribution.
 */
export function isHumanShapedName(raw: string | null | undefined): NameShapeResult {
  const name = (raw ?? "").trim();

  if (!name) return { ok: false, reason: "empty" };
  if (name.includes("\n") || name.includes("\r")) return { ok: false, reason: "multiline" };

  // Length: 3..40. Below 3 is initials/noise, above 40 is a sentence.
  if (name.length < 3) return { ok: false, reason: "too_short" };
  if (name.length > 40) return { ok: false, reason: "too_long" };

  // Must contain at least one letter — pure numbers/punctuation are never names.
  if (!/[a-zA-Z]/.test(name)) return { ok: false, reason: "no_letters" };

  // Reject anything that reads as a sentence/heading rather than a name.
  if (name.split(/\s+/).length > 5) return { ok: false, reason: "too_many_words" };

  const lower = name.toLowerCase();

  // --- Date-shaped: "August 4th VIP", "8/4", "Aug 4 Picks", "2026-08-04" ---
  if (new RegExp(`\\b(${MONTHS})\\b`, "i").test(lower)) return { ok: false, reason: "date_month" };
  if (/\b\d{1,2}(st|nd|rd|th)\b/i.test(lower)) return { ok: false, reason: "date_ordinal" };
  if (/\b\d{1,2}\s*[\/\-]\s*\d{1,2}\b/.test(lower)) return { ok: false, reason: "date_numeric" };
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(lower)) return { ok: false, reason: "date_iso" };

  // --- Weekday-shaped: "Friday", "Saturday Picks" ---
  if (new RegExp(`\\b(${WEEKDAYS})\\b`, "i").test(lower)) return { ok: false, reason: "weekday" };

  // --- Matchup-shaped: "Yankees vs Red Sox", "LAD @ SF" ---
  if (/\b(vs\.?|versus|@)\b/i.test(lower)) return { ok: false, reason: "matchup" };

  // --- Odds/line fragments that leaked out of a pick line ---
  if (/[+-]\d{2,}/.test(name)) return { ok: false, reason: "odds_fragment" };
  if (/\b(over|under|o|u)\s*\d/i.test(lower)) return { ok: false, reason: "line_fragment" };
  if (/\b(ml|moneyline|spread|parlay|teaser)\b/i.test(lower)) return { ok: false, reason: "market_fragment" };

  // --- Pure system/heading labels once decorations are stripped ---
  const stripped = lower.replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  if (!stripped) return { ok: false, reason: "no_alpha_core" };
  if (SYSTEM_WORDS.includes(stripped)) return { ok: false, reason: "system_label" };

  // A name made ONLY of generic words ("VIP Picks", "Free Plays") is a heading.
  const words = stripped.split(" ");
  if (words.every((w) => SYSTEM_WORDS.includes(w))) return { ok: false, reason: "generic_label_only" };

  return { ok: true, reason: null };
}

export interface CreateGateInput {
  /** Raw display name as extracted. */
  name: string;
  /** Normalized identity key (caller's normalizeName output). */
  normalized: string;
  /** Extraction confidence 0..100. */
  confidence: number;
  /** Distinct message identity — the second-sighting rule is keyed on this. */
  sourceMessageId: string | null | undefined;
  /** Provenance tag, e.g. "direct_extract" | "aggregator_extract" | "image_extract". */
  source: string;
  groupType?: string | null;
}

export interface CreateGateResult {
  /** True only when a real sbo_cappers row should be minted. */
  allow: boolean;
  reason: string;
  /** Sightings recorded so far for this normalized name (post-update). */
  sightings: number;
}

/**
 * The CREATE half of the split. Call ONLY after resolution has failed.
 *
 * Side effect by design: every blocked candidate is recorded/incremented in
 * sbo_pending_capper_identities. That is what makes the second sighting
 * possible, and it means no candidate is ever silently dropped.
 *
 * Never throws — a bookkeeping failure must not break intake. On error it
 * fails CLOSED (allow=false), because the cost of a missed identity is a
 * pending row a human can promote, while the cost of a wrong one is
 * permanent attribution damage.
 */
export async function shouldCreateCapper(
  supabase: any,
  input: CreateGateInput,
): Promise<CreateGateResult> {
  const { name, normalized, confidence, sourceMessageId, source, groupType } = input;

  // (A) shape
  const shape = isHumanShapedName(name);
  if (!shape.ok) {
    await recordPending(supabase, input, `shape:${shape.reason}`);
    return { allow: false, reason: `not_human_shaped:${shape.reason}`, sightings: 0 };
  }

  if (!normalized || normalized.length < 3) {
    await recordPending(supabase, input, "shape:normalized_too_short");
    return { allow: false, reason: "normalized_too_short", sightings: 0 };
  }

  // (B) confidence
  if (!(confidence >= MIN_CREATE_CONFIDENCE)) {
    await recordPending(supabase, input, `confidence:${confidence}`);
    return { allow: false, reason: `below_confidence:${confidence}`, sightings: 0 };
  }

  // (B5) second sighting across DISTINCT source messages
  try {
    const msgId = (sourceMessageId ?? "").toString().trim();

    const { data: existing } = await supabase
      .from("sbo_pending_capper_identities")
      .select("id, seen_message_ids, sighting_count")
      .eq("normalized_name", normalized)
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await supabase.from("sbo_pending_capper_identities").insert({
        normalized_name: normalized,
        display_name: name.trim(),
        source,
        group_type: groupType ?? null,
        confidence,
        sighting_count: 1,
        seen_message_ids: msgId ? [msgId] : [],
      });
      if (insErr && insErr.code !== "23505") {
        console.error("[capperIdentity] pending insert failed:", insErr.message);
      }
      return { allow: false, reason: "first_sighting_parked", sightings: 1 };
    }

    const seen: string[] = Array.isArray(existing.seen_message_ids) ? existing.seen_message_ids : [];

    // Same message re-processed (retry / edit) is NOT a second sighting.
    if (msgId && seen.includes(msgId)) {
      return { allow: false, reason: "duplicate_sighting_same_message", sightings: seen.length };
    }

    const nextSeen = msgId ? [...seen, msgId] : seen;
    const nextCount = nextSeen.length || (existing.sighting_count ?? 0) + 1;

    await supabase
      .from("sbo_pending_capper_identities")
      .update({
        seen_message_ids: nextSeen,
        sighting_count: nextCount,
        confidence,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (nextCount >= REQUIRED_SIGHTINGS) {
      return { allow: true, reason: "second_sighting_confirmed", sightings: nextCount };
    }
    return { allow: false, reason: "awaiting_second_sighting", sightings: nextCount };
  } catch (e) {
    console.error("[capperIdentity] gate error, failing closed:", e instanceof Error ? e.message : e);
    return { allow: false, reason: "gate_error_fail_closed", sightings: 0 };
  }
}

/** Best-effort bookkeeping for candidates rejected before the sighting stage. */
async function recordPending(supabase: any, input: CreateGateInput, rejected: string): Promise<void> {
  try {
    const key = input.normalized && input.normalized.length >= 2
      ? input.normalized
      : (input.name || "").trim().toLowerCase().slice(0, 60);
    if (!key) return;

    const msgId = (input.sourceMessageId ?? "").toString().trim();
    const { data: existing } = await supabase
      .from("sbo_pending_capper_identities")
      .select("id, seen_message_ids")
      .eq("normalized_name", key)
      .maybeSingle();

    if (!existing) {
      await supabase.from("sbo_pending_capper_identities").insert({
        normalized_name: key,
        display_name: (input.name || "").trim().slice(0, 200) || key,
        source: input.source,
        group_type: input.groupType ?? null,
        confidence: input.confidence,
        sighting_count: 1,
        seen_message_ids: msgId ? [msgId] : [],
        rejected_reason: rejected,
      });
      return;
    }

    const seen: string[] = Array.isArray(existing.seen_message_ids) ? existing.seen_message_ids : [];
    const nextSeen = msgId && !seen.includes(msgId) ? [...seen, msgId] : seen;
    await supabase
      .from("sbo_pending_capper_identities")
      .update({
        seen_message_ids: nextSeen,
        sighting_count: nextSeen.length || seen.length || 1,
        rejected_reason: rejected,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } catch (e) {
    console.error("[capperIdentity] recordPending failed:", e instanceof Error ? e.message : e);
  }
}

/** Mark a pending candidate as promoted once its sbo_cappers row exists. */
export async function markPendingPromoted(
  supabase: any,
  normalized: string,
  capperId: string,
): Promise<void> {
  try {
    await supabase
      .from("sbo_pending_capper_identities")
      .update({ promoted_at: new Date().toISOString(), promoted_capper_id: capperId })
      .eq("normalized_name", normalized);
  } catch (e) {
    console.error("[capperIdentity] markPendingPromoted failed:", e instanceof Error ? e.message : e);
  }
}
