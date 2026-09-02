// ═══════════════════════════════════════════════════════════════════════════
// ICW LEAD INGESTION — dedupe + canonical upsert for icw_sourced_leads
// ═══════════════════════════════════════════════════════════════════════════
//
// Dedupe is enforced HERE, in application logic — the DB has no unique
// constraint that could express "same real-world person". A rerun that matches
// an existing lead UPDATES that row (verifiedUpdate); it never inserts a
// second row for the same person.
//
// Match order:
//   Regulated / licensed leads: license_number → phone → name+address
//   Non-licensed leads:         source_id (scoped to source_platform)
//                               → phone → name+city+state
//
// All writes go through verifiedInsert / verifiedUpdate — no raw
// .insert()/.update()/.delete() anywhere in this module.

import { supabase } from '@/integrations/supabase/client';
import { verifiedInsert, verifiedUpdate } from '@/lib/verifiedMutation';

export interface ICWSourcedLead {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  website_social: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  category_groups: string[] | null;
  source_platform: string | null;
  source_url: string | null;
  source_id: string | null;
  license_number: string | null;
  license_type: string | null;
  license_status: string | null;
  notes: string | null;
  status: string;
  promoted_worker_id: string | null;
  ingestion_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ICWLeadInput = Partial<Omit<ICWSourcedLead, 'id' | 'created_at' | 'updated_at'>>;

// ── Country normalization ──────────────────────────────────────────────────
// `country` is stored as the human label used at ingest time ('US', 'Canada',
// 'United Kingdom', …). Dedupe compares ISO-ish codes, never raw labels.
const COUNTRY_ALIASES: Record<string, string> = {
  us: 'US', usa: 'US', 'u s a': 'US', 'united states': 'US', 'united states of america': 'US',
  ca: 'CA', canada: 'CA',
  gb: 'GB', uk: 'GB', 'united kingdom': 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  au: 'AU', australia: 'AU',
  ie: 'IE', ireland: 'IE', eire: 'IE', 'republic of ireland': 'IE',
};

/** Default is 'US' — matches the icw_sourced_leads.country column default. */
export function normalizeCountry(raw: string | null | undefined): string {
  const key = (raw ?? '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!key) return 'US';
  return COUNTRY_ALIASES[key] ?? key.toUpperCase().replace(/\s+/g, '_');
}

// Calling code + how the national number is derived, per country.
// NANP (US/CA) keeps the exact legacy last-10 behaviour.
const COUNTRY_PHONE: Record<string, { code: string; nanp?: boolean; minLen: number }> = {
  US: { code: '1', nanp: true, minLen: 10 },
  CA: { code: '1', nanp: true, minLen: 10 },
  GB: { code: '44', minLen: 9 },
  AU: { code: '61', minLen: 8 },
  IE: { code: '353', minLen: 7 },
};

/**
 * Canonical US/NANP phone key — UNCHANGED legacy behaviour.
 * Digits-only, drops a leading "1", returns the last 10 digits.
 * Use `phoneDedupeKey` for anything that may not be US.
 */
export function normalizePhoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Back-compat alias — same last-10 normalization used across the OS. */
export const phoneLast10 = normalizePhoneKey;

/**
 * Country-scoped phone dedupe key: `"<COUNTRY>:<national significant number>"`.
 *
 * - US / CA (NANP): last 10 digits after dropping a leading 1 — identical to
 *   normalizePhoneKey, so existing US matching is bit-for-bit unchanged.
 * - GB / AU / IE: strip an international prefix (00/011), strip the country
 *   calling code, then strip the national trunk "0".
 * - Any other country: digits only, international prefix + trunk 0 removed.
 *
 * The country prefix means two rows in DIFFERENT countries can never match on
 * phone, even when their trailing digits coincide.
 */
export function phoneDedupeKey(
  raw: string | null | undefined,
  country: string | null | undefined,
): string | null {
  if (!raw) return null;
  const cc = normalizeCountry(country);
  const rules = COUNTRY_PHONE[cc];

  // Preserve the legacy NANP algorithm exactly, while adding the country
  // namespace so US and CA numbers never match each other on phone alone.
  if (rules?.nanp) {
    const nationalKey = normalizePhoneKey(raw);
    return nationalKey ? `${cc}:${nationalKey}` : null;
  }

  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  // International access prefixes for non-NANP formats.
  digits = digits.replace(/^00/, '').replace(/^011/, '');

  const code = rules?.code;
  if (code && digits.length > code.length + 4 && digits.startsWith(code)) {
    digits = digits.slice(code.length);
  }
  digits = digits.replace(/^0+/, '');
  const minLen = rules?.minLen ?? 6;
  if (digits.length < minLen) return null;
  return `${cc}:${digits}`;
}


export function normText(raw: string | null | undefined): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normLicense(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return v.length ? v : null;
}

export type MatchReason =
  | 'license_number'
  | 'source_id'
  | 'phone'
  | 'name_address'
  | 'name_city_state';

export interface DedupeMatch {
  lead: ICWSourcedLead;
  reason: MatchReason;
}


async function fetchCandidates(input: ICWLeadInput): Promise<ICWSourcedLead[]> {
  // Pull a narrow candidate set, then decide the winner in ordered logic below.
  const filters: string[] = [];
  const license = normLicense(input.license_number);
  const phoneKey = phoneDedupeKey(input.phone, input.country);

  if (license) filters.push(`license_number.not.is.null`);
  if (phoneKey) filters.push(`phone.not.is.null`);
  if (input.source_id) filters.push(`source_id.eq.${input.source_id}`);
  if (input.full_name) filters.push(`full_name.not.is.null`);

  if (filters.length === 0) return [];

  const { data, error } = await supabase
    .from('icw_sourced_leads')
    .select('*')
    .or(filters.join(','))
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as ICWSourcedLead[];
}

/**
 * Find the existing canonical lead for this input, if any.
 * Regulated leads (a license number present) use the licensed match order.
 *
 * Every locality-based match (license, phone, name+place) is scoped to the
 * SAME normalized country, so an Ontario business can never collide with a
 * US business that happens to share trailing digits or a name.
 */
export async function findExistingLead(input: ICWLeadInput): Promise<DedupeMatch | null> {
  const all = await fetchCandidates(input);
  if (all.length === 0) return null;

  const country = normalizeCountry(input.country);
  const license = normLicense(input.license_number);
  const phoneKey = phoneDedupeKey(input.phone, input.country);
  const name = normText(input.full_name);
  const addr = normText(input.address);
  const city = normText(input.city);
  const place = normText(input.region || input.state);
  const isRegulated = Boolean(license);

  // Country-scoped candidate pool for locality-based matching.
  const candidates = all.filter((c) => normalizeCountry(c.country) === country);

  if (isRegulated) {
    const byLicense = candidates.find((c) => normLicense(c.license_number) === license);
    if (byLicense) return { lead: byLicense, reason: 'license_number' };
  } else if (input.source_id && input.source_platform) {
    // source_id is globally unique per platform — not country-scoped.
    const bySource = all.find(
      (c) => c.source_id === input.source_id && c.source_platform === input.source_platform,
    );
    if (bySource) return { lead: bySource, reason: 'source_id' };
  }

  if (phoneKey) {
    const byPhone = candidates.find((c) => phoneDedupeKey(c.phone, c.country) === phoneKey);
    if (byPhone) return { lead: byPhone, reason: 'phone' };
  }

  if (name) {
    if (isRegulated && addr) {
      const byNameAddr = candidates.find(
        (c) => normText(c.full_name) === name && normText(c.address) === addr,
      );
      if (byNameAddr) return { lead: byNameAddr, reason: 'name_address' };
    }
    if (!isRegulated && (city || place)) {
      const byNameCityState = candidates.find(
        (c) =>
          normText(c.full_name) === name &&
          normText(c.city) === city &&
          normText(c.region || c.state) === place,
      );
      if (byNameCityState) return { lead: byNameCityState, reason: 'name_city_state' };
    }
  }



  return null;
}

/** Only overwrite an existing field when the incoming value is non-empty. */
function mergePatch(existing: ICWSourcedLead, input: ICWLeadInput): ICWLeadInput {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (key === 'status' && existing.status !== 'prospect') continue; // never regress a worked lead
    patch[key] = value;
  }
  return patch as ICWLeadInput;
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTERED / LEGAL ADDRESS vs VERIFIED OPERATING LOCATION
// ═══════════════════════════════════════════════════════════════════════════
// A company-registry address (Companies House, CRO, ASIC, Corporations Canada,
// OpenCorporates, a Secretary-of-State filing, …) is a LEGAL address. It is not
// evidence the business operates there. Such a lead NEVER gets a map pin: it is
// forced into mapping-gap treatment (lat/long cleared) and its note is stamped
// REGISTERED-ADDRESS-ONLY. A pin is only allowed once a SECOND reliable source
// confirms the address as an actual operating/service location — expressed by
// passing `addressProvenance.operatingConfirmedBy`.
//
// This is enforced inside upsertSourcedLead, so it applies to every ingestion
// path (UI, script, one-shot edge function) with no per-lead reminder.

export const REGISTERED_ADDRESS_ONLY_MARKER = 'REGISTERED-ADDRESS-ONLY';

/** Source platforms whose address is, by definition, a registered/legal office. */
export const REGISTRY_SOURCE_PLATFORMS = new Set([
  'companies_house',
  'companies-house',
  'uk_companies_house',
  'cro',
  'cro_ie',
  'irish_cro',
  'asic',
  'abr',
  'corporations_canada',
  'ontario_business_registry',
  'opencorporates',
  'sos_business_registry',
  'secretary_of_state',
  'state_business_registry',
]);

export interface AddressProvenance {
  /** True when the only address we hold came from a company registry filing. */
  registryRegisteredOffice?: boolean;
  /** Name/URL of the SECOND independent source confirming real operations there. */
  operatingConfirmedBy?: string | null;
}

/** Registry-sourced address with no independent operating confirmation? */
export function isRegisteredAddressOnly(
  input: ICWLeadInput,
  provenance?: AddressProvenance,
): boolean {
  if (provenance?.operatingConfirmedBy) return false;
  if (provenance?.registryRegisteredOffice) return true;
  const platform = (input.source_platform ?? '').toLowerCase().trim().replace(/\s+/g, '_');
  if (platform && REGISTRY_SOURCE_PLATFORMS.has(platform)) return true;
  // Belt and braces: an explicit registered-office note counts as registry-only.
  return /registered\s+(office|address)/i.test(input.notes ?? '');
}

/**
 * Force mapping-gap treatment on registry-only addresses: clear the pin and
 * stamp the note. Idempotent — re-stamping an already-marked note is a no-op.
 */
export function applyAddressProvenanceRule(
  input: ICWLeadInput,
  provenance?: AddressProvenance,
): ICWLeadInput {
  if (!isRegisteredAddressOnly(input, provenance)) return input;
  const note = input.notes ?? '';
  const stamped = note.includes(REGISTERED_ADDRESS_ONLY_MARKER)
    ? note
    : [
        `${REGISTERED_ADDRESS_ONLY_MARKER}: address is a company-registry registered/legal office, not a confirmed operating location. No map pin until a second reliable source confirms operations at this address.`,
        note,
      ]
        .filter(Boolean)
        .join(' | ');
  return { ...input, latitude: null, longitude: null, notes: stamped };
}

export type UpsertOutcome =
  /** No match at all — brand new row. */
  | 'inserted'
  /** Matched a row that existed BEFORE this run started. */
  | 'duplicate_preexisting'
  /** Matched a row THIS run inserted earlier — counts as a fresh insert. */
  | 'same_run_self_match';

export interface UpsertResult {
  lead: ICWSourcedLead;
  action: 'inserted' | 'updated';
  outcome: UpsertOutcome;
  matchReason?: MatchReason;
  registeredAddressOnly: boolean;
}

/** Tracks the ids this run has inserted so self-matches are never misreported. */
export interface IngestRunContext {
  insertedIds: Set<string>;
}

export function createIngestRunContext(): IngestRunContext {
  return { insertedIds: new Set<string>() };
}

export interface UpsertOptions {
  run?: IngestRunContext;
  addressProvenance?: AddressProvenance;
}

/**
 * Canonical entry point for ingesting a sourced lead.
 * Matches → verifiedUpdate; no match → verifiedInsert.
 */
export async function upsertSourcedLead(
  rawInput: ICWLeadInput,
  options: UpsertOptions = {},
): Promise<UpsertResult> {
  const input = applyAddressProvenanceRule(rawInput, options.addressProvenance);
  const registeredAddressOnly = isRegisteredAddressOnly(rawInput, options.addressProvenance);
  const match = await findExistingLead(input);

  if (match) {
    const patch = mergePatch(match.lead, input);
    // Registry-only leads must lose any pre-existing pin too — mergePatch skips
    // nulls, so clear the coordinates explicitly.
    if (registeredAddressOnly) {
      (patch as Record<string, unknown>).latitude = null;
      (patch as Record<string, unknown>).longitude = null;
    }
    const rows = await verifiedUpdate<ICWSourcedLead>('update ICW sourced lead', () =>
      supabase
        .from('icw_sourced_leads')
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq('id', match.lead.id),
    );
    const selfMatch = Boolean(options.run?.insertedIds.has(match.lead.id));
    return {
      lead: rows[0] ?? match.lead,
      action: 'updated',
      outcome: selfMatch ? 'same_run_self_match' : 'duplicate_preexisting',
      matchReason: match.reason,
      registeredAddressOnly,
    };
  }

  const rows = await verifiedInsert<ICWSourcedLead>('insert ICW sourced lead', () =>
    supabase.from('icw_sourced_leads').insert(input as never),
  );
  if (rows[0]?.id) options.run?.insertedIds.add(rows[0].id);
  return { lead: rows[0], action: 'inserted', outcome: 'inserted', registeredAddressOnly };
}

export interface IngestBatchSummary {
  results: UpsertResult[];
  /** (c) brand-new rows with no match at all. */
  newLeadCount: number;
  /** (b) matched a row this same run inserted — reported as a fresh insert. */
  sameRunSelfMatchCount: number;
  /** (a) matched a row that pre-dated this run. */
  preExistingDuplicateCount: number;
  /** newLeadCount + sameRunSelfMatchCount — rows this run actually added. */
  netNewRowCount: number;
  registeredAddressOnlyCount: number;
  rawResultCount: number;
}

/**
 * Batch helper. Reports the three outcomes SEPARATELY — a same-run self-match
 * is never lumped in with a true pre-existing duplicate.
 */
export async function ingestSourcedLeads(
  inputs: ICWLeadInput[],
  options: { addressProvenanceFor?: (input: ICWLeadInput) => AddressProvenance | undefined } = {},
): Promise<IngestBatchSummary> {
  const run = createIngestRunContext();
  const results: UpsertResult[] = [];
  let newLeadCount = 0;
  let sameRunSelfMatchCount = 0;
  let preExistingDuplicateCount = 0;
  let registeredAddressOnlyCount = 0;

  for (const input of inputs) {
    const res = await upsertSourcedLead(input, {
      run,
      addressProvenance: options.addressProvenanceFor?.(input),
    });
    if (res.outcome === 'inserted') newLeadCount++;
    else if (res.outcome === 'same_run_self_match') sameRunSelfMatchCount++;
    else preExistingDuplicateCount++;
    if (res.registeredAddressOnly) registeredAddressOnlyCount++;
    results.push(res);
  }

  return {
    results,
    newLeadCount,
    sameRunSelfMatchCount,
    preExistingDuplicateCount,
    netNewRowCount: newLeadCount + sameRunSelfMatchCount,
    registeredAddressOnlyCount,
    rawResultCount: inputs.length,
  };
}

