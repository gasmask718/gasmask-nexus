// ═══════════════════════════════════════════════════════════════════════════
// ICW CANDIDATE INGESTION — dedupe + canonical upsert for icw_candidate_leads
// ═══════════════════════════════════════════════════════════════════════════
//
// Candidate leads are INDIVIDUAL people applying to work as independent
// contractor cleaners (sourced from job/gig boards), NOT businesses. They live
// in their own table; icw_sourced_leads stays business-shaped.
//
// Dedupe order (all locality matching scoped to the same normalized country):
//   source_id (scoped to source_platform, globally unique per platform)
//     → country-scoped phone key
//     → normText(full_name) + city + state/region
//
// Batch runs report the SAME three outcomes as business-lead runs:
//   inserted | same_run_self_match | duplicate_preexisting
//
// All writes go through verifiedInsert / verifiedUpdate — never raw
// .insert()/.update() and never raw SQL.

import { supabase } from '@/integrations/supabase/client';
import { verifiedInsert, verifiedUpdate } from '@/lib/verifiedMutation';
import {
  normalizeCountry,
  normText,
  phoneDedupeKey,
  createIngestRunContext,
  type IngestRunContext,
} from './leadIngestion';

export interface ICWCandidateLead {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  country: string | null;
  service_area: string | null;
  category_groups: string[] | null;
  source_platform: string | null;
  source_url: string | null;
  source_id: string | null;
  experience_summary: string | null;
  availability_summary: string | null;
  notes: string | null;
  status: string;
  ingestion_run_id: string | null;
  converted_worker_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ICWCandidateInput = Partial<
  Omit<ICWCandidateLead, 'id' | 'created_at' | 'updated_at'>
>;

export type CandidateMatchReason = 'source_id' | 'phone' | 'name_city_state';

export interface CandidateDedupeMatch {
  candidate: ICWCandidateLead;
  reason: CandidateMatchReason;
}

async function fetchCandidateRows(input: ICWCandidateInput): Promise<ICWCandidateLead[]> {
  const filters: string[] = [];
  const phoneKey = phoneDedupeKey(input.phone, input.country);

  if (phoneKey) filters.push('phone.not.is.null');
  if (input.source_id) filters.push(`source_id.eq.${input.source_id}`);
  if (input.full_name) filters.push('full_name.not.is.null');

  if (filters.length === 0) return [];

  const { data, error } = await supabase
    .from('icw_candidate_leads')
    .select('*')
    .or(filters.join(','))
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as unknown as ICWCandidateLead[];
}

/**
 * Find the existing canonical candidate row for this input, if any.
 * There is no company name to match on, so identity is
 * source_id → phone → person name + place.
 */
export async function findExistingCandidate(
  input: ICWCandidateInput,
): Promise<CandidateDedupeMatch | null> {
  const all = await fetchCandidateRows(input);
  if (all.length === 0) return null;

  const country = normalizeCountry(input.country);
  const phoneKey = phoneDedupeKey(input.phone, input.country);
  const name = normText(input.full_name);
  const city = normText(input.city);
  const place = normText(input.region || input.state);

  // source_id is unique per platform — not country-scoped.
  if (input.source_id && input.source_platform) {
    const bySource = all.find(
      (c) => c.source_id === input.source_id && c.source_platform === input.source_platform,
    );
    if (bySource) return { candidate: bySource, reason: 'source_id' };
  }

  // Locality matching only inside the same normalized country.
  const scoped = all.filter((c) => normalizeCountry(c.country) === country);

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

/** Only overwrite an existing field when the incoming value is non-empty. */
function mergeCandidatePatch(input: ICWCandidateInput): ICWCandidateInput {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    patch[key] = value;
  }
  return patch as ICWCandidateInput;
}

export type CandidateUpsertOutcome =
  | 'inserted'
  | 'duplicate_preexisting'
  | 'same_run_self_match';

export interface CandidateUpsertResult {
  candidate: ICWCandidateLead;
  action: 'inserted' | 'updated';
  outcome: CandidateUpsertOutcome;
  matchReason?: CandidateMatchReason;
}

export interface CandidateUpsertOptions {
  run?: IngestRunContext;
}

/**
 * Canonical entry point for ingesting one candidate lead.
 * Match → verifiedUpdate; no match → verifiedInsert.
 */
export async function upsertCandidateLead(
  input: ICWCandidateInput,
  options: CandidateUpsertOptions = {},
): Promise<CandidateUpsertResult> {
  const match = await findExistingCandidate(input);

  if (match) {
    const patch = mergeCandidatePatch(input);
    const rows = await verifiedUpdate<ICWCandidateLead>('update ICW candidate lead', () =>
      supabase
        .from('icw_candidate_leads')
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq('id', match.candidate.id),
    );
    const selfMatch = Boolean(options.run?.insertedIds.has(match.candidate.id));
    return {
      candidate: rows[0] ?? match.candidate,
      action: 'updated',
      outcome: selfMatch ? 'same_run_self_match' : 'duplicate_preexisting',
      matchReason: match.reason,
    };
  }

  const rows = await verifiedInsert<ICWCandidateLead>('insert ICW candidate lead', () =>
    supabase.from('icw_candidate_leads').insert(input as never),
  );
  if (rows[0]?.id) options.run?.insertedIds.add(rows[0].id);
  return { candidate: rows[0], action: 'inserted', outcome: 'inserted' };
}

export interface CandidateIngestBatchSummary {
  results: CandidateUpsertResult[];
  /** Brand-new rows with no match at all. */
  newCandidateCount: number;
  /** Matched a row this same run inserted — reported as a fresh insert. */
  sameRunSelfMatchCount: number;
  /** Matched a row that pre-dated this run. */
  preExistingDuplicateCount: number;
  /** newCandidateCount + sameRunSelfMatchCount — rows this run actually added. */
  netNewRowCount: number;
  rawResultCount: number;
}

/**
 * Batch helper. Reports the three outcomes SEPARATELY — a same-run self-match
 * is never lumped in with a true pre-existing duplicate.
 */
export async function ingestCandidateLeads(
  inputs: ICWCandidateInput[],
): Promise<CandidateIngestBatchSummary> {
  const run = createIngestRunContext();
  const results: CandidateUpsertResult[] = [];
  let newCandidateCount = 0;
  let sameRunSelfMatchCount = 0;
  let preExistingDuplicateCount = 0;

  for (const input of inputs) {
    const res = await upsertCandidateLead(input, { run });
    if (res.outcome === 'inserted') newCandidateCount++;
    else if (res.outcome === 'same_run_self_match') sameRunSelfMatchCount++;
    else preExistingDuplicateCount++;
    results.push(res);
  }

  return {
    results,
    newCandidateCount,
    sameRunSelfMatchCount,
    preExistingDuplicateCount,
    netNewRowCount: newCandidateCount + sameRunSelfMatchCount,
    rawResultCount: inputs.length,
  };
}
