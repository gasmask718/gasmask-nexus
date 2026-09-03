// ═══════════════════════════════════════════════════════════════════════════
// ICW CANDIDATE DEDUPE — Deno mirror of src/lib/icw/candidateIngestion.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// Same rules, same order, same three outcomes as the browser-side path:
//   source_id (per platform) → country-scoped phone key → name + city + place
//
// Kept in sync BY HAND with src/lib/icw/{leadIngestion,candidateIngestion}.ts
// (same pattern as _shared/recipientEmail.ts). Edge functions cannot import
// from src/. Any change to the dedupe rules must be made in both files.

const COUNTRY_ALIASES: Record<string, string> = {
  us: 'US', usa: 'US', 'u s a': 'US', 'united states': 'US', 'united states of america': 'US',
  ca: 'CA', canada: 'CA',
  gb: 'GB', uk: 'GB', 'united kingdom': 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  au: 'AU', australia: 'AU',
  ie: 'IE', ireland: 'IE', eire: 'IE', 'republic of ireland': 'IE',
};

const COUNTRY_PHONE: Record<string, { code: string; nanp?: boolean; minLen: number }> = {
  US: { code: '1', nanp: true, minLen: 10 },
  CA: { code: '1', nanp: true, minLen: 10 },
  GB: { code: '44', minLen: 9 },
  AU: { code: '61', minLen: 8 },
  IE: { code: '353', minLen: 7 },
};

export function normalizeCountry(raw: string | null | undefined): string {
  const key = (raw ?? '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!key) return 'US';
  return COUNTRY_ALIASES[key] ?? key.toUpperCase().replace(/\s+/g, '_');
}

export function normalizePhoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function phoneDedupeKey(
  raw: string | null | undefined,
  country: string | null | undefined,
): string | null {
  if (!raw) return null;
  const cc = normalizeCountry(country);
  const rules = COUNTRY_PHONE[cc];
  if (rules?.nanp) {
    const nationalKey = normalizePhoneKey(raw);
    return nationalKey ? `${cc}:${nationalKey}` : null;
  }
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  digits = digits.replace(/^00/, '').replace(/^011/, '');
  const code = rules?.code;
  if (code && digits.length > code.length + 4 && digits.startsWith(code)) {
    digits = digits.slice(code.length);
  }
  digits = digits.replace(/^0+/, '');
  if (digits.length < (rules?.minLen ?? 6)) return null;
  return `${cc}:${digits}`;
}

export function normText(raw: string | null | undefined): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type CandidateMatchReason = 'source_id' | 'phone' | 'name_city_state';

// Zero-outreach phase: ingestion never advances a candidate past 'reviewing'.
const INGEST_ALLOWED_STATUSES = new Set(['candidate', 'reviewing']);

export function sanitizeCandidateInput<T extends Record<string, unknown>>(input: T): T {
  const status = input.status as string | undefined;
  if (status !== undefined && !INGEST_ALLOWED_STATUSES.has(status)) {
    const { status: _dropped, ...rest } = input;
    return rest as T;
  }
  return input;
}

export function findExistingCandidate(
  rows: Record<string, any>[],
  input: Record<string, any>,
): { candidate: Record<string, any>; reason: CandidateMatchReason } | null {
  if (rows.length === 0) return null;

  const country = normalizeCountry(input.country);
  const phoneKey = phoneDedupeKey(input.phone, input.country);
  const name = normText(input.full_name);
  const city = normText(input.city);
  const place = normText(input.region || input.state);

  if (input.source_id && input.source_platform) {
    const bySource = rows.find(
      (c) => c.source_id === input.source_id && c.source_platform === input.source_platform,
    );
    if (bySource) return { candidate: bySource, reason: 'source_id' };
  }

  const scoped = rows.filter((c) => normalizeCountry(c.country) === country);

  if (phoneKey) {
    const byPhone = scoped.find((c) => phoneDedupeKey(c.phone, c.country) === phoneKey);
    if (byPhone) return { candidate: byPhone, reason: 'phone' };
  }

  if (name && (city || place)) {
    const byName = scoped.find(
      (c) =>
        normText(c.full_name) === name &&
        normText(c.city) === city &&
        normText(c.region || c.state) === place,
    );
    if (byName) return { candidate: byName, reason: 'name_city_state' };
  }

  return null;
}
