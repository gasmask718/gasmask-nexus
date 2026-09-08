// Deterministic pack-count extraction. NOT an AI call — pure regex over text that
// was actually read (vision recognition, label OCR) or typed by a human.
//
// Contract: returns a pack_count ONLY when the text clearly states one. Ambiguous
// text ("Family Pack", "Value Size", or two conflicting counts) → null with a
// reason. Never defaults to 1 or any other guess.

export interface PackCountParse {
  pack_count: number | null;
  /** Which input the number came from (human | label_units_per_case | recognition.size_or_count | ...) */
  source: string | null;
  /** The literal text fragment that produced the number, for reviewer visibility. */
  matched_text: string | null;
  reason: string;
  candidates: { source: string; text: string; count: number }[];
}

const COUNT_WORDS = '(?:ct|count|pk|pack|packs|pcs|pieces|units|lighters|bags|bottles|cans|jars|tubes|sticks|rolls|cones|wraps)';
const CONTAINER_WORDS = '(?:pack|case|box|tray|carton|display|lot|set|sleeve|bundle)';

const PATTERNS: { re: RegExp; pick: (m: RegExpMatchArray) => number }[] = [
  // "50 + 3 Bonus", "50+3 free"
  { re: /\b(\d{1,5})\s*\+\s*(\d{1,4})\s*(?:bonus|free|extra)\b/i, pick: (m) => Number(m[1]) + Number(m[2]) },
  // "pack of 12", "case of 24", "tray of 50"
  { re: new RegExp(`\\b${CONTAINER_WORDS}\\s+of\\s+(\\d{1,5})\\b`, 'i'), pick: (m) => Number(m[1]) },
  // "50 count", "50ct", "12-pack", "24 pcs", "50 count tray"
  { re: new RegExp(`\\b(\\d{1,5})\\s*[-\\s]?${COUNT_WORDS}\\b`, 'i'), pick: (m) => Number(m[1]) },
  // "50/tray", "12 per case"
  { re: new RegExp(`\\b(\\d{1,5})\\s*(?:/|per)\\s*${CONTAINER_WORDS}\\b`, 'i'), pick: (m) => Number(m[1]) },
];

/** Parse ONE text fragment. Returns the count or null. */
export function parsePackCountText(text: string | null | undefined): { count: number | null; matched: string | null } {
  if (!text) return { count: null, matched: null };
  const t = String(text).trim();
  if (!t) return { count: null, matched: null };
  for (const { re, pick } of PATTERNS) {
    const m = t.match(re);
    if (m) {
      const n = pick(m);
      if (Number.isInteger(n) && n >= 1 && n <= 10000) return { count: n, matched: m[0] };
    }
  }
  return { count: null, matched: null };
}

export interface PackCountInputs {
  /** Human-entered count on the draft (highest priority, never overridden). */
  human_pack_count?: number | null;
  /** label_extraction.units_per_case — a number the OCR actually read. */
  label_units_per_case?: number | string | null;
  recognition?: { size_or_count?: string | null; package_text?: string | null } | null;
  label_extraction?: Record<string, unknown> | null;
}

/**
 * Resolve the pack count for a draft from what was actually read/typed.
 * Priority: human entry > label OCR units_per_case > recognition.size_or_count
 * > recognition.package_text > label OCR free text. Conflicting parsed values
 * (from different fragments) → null, reason 'ambiguous'.
 */
export function resolvePackCount(inputs: PackCountInputs): PackCountParse {
  const candidates: PackCountParse['candidates'] = [];

  const human = inputs.human_pack_count;
  if (human != null && Number.isInteger(Number(human)) && Number(human) >= 1) {
    return { pack_count: Number(human), source: 'human', matched_text: String(human), reason: 'human-entered pack count', candidates };
  }

  const labelUnits = inputs.label_units_per_case == null ? NaN : Number(inputs.label_units_per_case);
  if (Number.isInteger(labelUnits) && labelUnits > 1) {
    return { pack_count: labelUnits, source: 'label_units_per_case', matched_text: String(labelUnits), reason: 'read from printed label (units per case)', candidates };
  }

  const fragments: { source: string; text: string | null | undefined }[] = [
    { source: 'recognition.size_or_count', text: inputs.recognition?.size_or_count },
    { source: 'recognition.package_text', text: inputs.recognition?.package_text },
  ];
  const le = inputs.label_extraction || {};
  for (const k of ['raw_text', 'text', 'package_text', 'size_text', 'net_contents']) {
    const v = (le as any)[k];
    if (typeof v === 'string' && v.trim()) fragments.push({ source: `label_extraction.${k}`, text: v });
  }

  for (const f of fragments) {
    const { count, matched } = parsePackCountText(f.text);
    if (count != null && matched) candidates.push({ source: f.source, text: matched, count });
  }

  if (!candidates.length) {
    const seen = fragments.filter((f) => f.text && String(f.text).trim()).map((f) => `${f.source}="${String(f.text).trim().slice(0, 60)}"`);
    return {
      pack_count: null, source: null, matched_text: null, candidates,
      reason: seen.length ? `no explicit pack count in ${seen.join(', ')}` : 'no pack/size text was read for this draft',
    };
  }

  const distinct = Array.from(new Set(candidates.map((c) => c.count)));
  if (distinct.length > 1) {
    return {
      pack_count: null, source: null, matched_text: null, candidates,
      reason: `ambiguous — conflicting counts read: ${candidates.map((c) => `${c.count} (${c.source})`).join(', ')}`,
    };
  }

  const first = candidates[0];
  return { pack_count: first.count, source: first.source, matched_text: first.text, reason: `parsed "${first.text}" from ${first.source}`, candidates };
}
