// Dynasty Direct — client helper for automatic shipping-spec sourcing.
//
// One reusable entry point used by Add Product, Bulk Import, the catalog
// wizard/review screen and the product detail panel. The app never invents
// dimensions: everything here only asks the backend to look, and reports
// what came back.

import { supabase } from '@/integrations/supabase/client';

export type SpecStatus =
  | 'confirmed'
  | 'high_confidence'
  | 'needs_review'
  | 'not_found'
  | 'sourcing'
  | 'manual';

export interface SpecCandidate {
  weight_oz: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
  packaged: boolean;
  source_url: string;
  source_name: string;
  matched_on: string[];
  retrieved_at: string;
  score?: number;
  raw?: Record<string, unknown>;
}

export interface SourcingRowResult {
  product_id: string;
  product_name?: string;
  status?: SpecStatus;
  applied?: boolean;
  cached?: boolean;
  reason?: string;
  skipped?: string;
  candidates?: number;
  chosen?: Partial<SpecCandidate> | null;
  error?: string;
}

/** Ask the backend to find missing shipping weight / dimensions. */
export async function requestSpecSourcing(
  productIds: string[],
  opts: { force?: boolean; triggeredBy?: string } = {},
): Promise<SourcingRowResult[]> {
  const ids = productIds.filter(Boolean);
  if (ids.length === 0) return [];
  const out: SourcingRowResult[] = [];
  // A single lookup runs several live web fetches, so batches stay small
  // enough to finish inside the edge request budget.
  for (let i = 0; i < ids.length; i += 4) {
    const { data, error } = await supabase.functions.invoke('dd-source-shipping-specs', {
      body: {
        product_ids: ids.slice(i, i + 4),
        force: !!opts.force,
        triggered_by: opts.triggeredBy ?? 'ui',
      },
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error(String((data as any).error));
    out.push(...(((data as any)?.results ?? []) as SourcingRowResult[]));
  }
  return out;
}

export function hasCompleteSpecs(p: {
  weight_oz?: number | null; length_in?: number | null;
  width_in?: number | null; height_in?: number | null;
}): boolean {
  return Number(p.weight_oz) > 0 && Number(p.length_in) > 0 &&
    Number(p.width_in) > 0 && Number(p.height_in) > 0;
}

/** Operator-facing badge for the Shipping Specs state. */
export function specStatusLabel(
  status: SpecStatus | null | undefined,
  complete: boolean,
): { label: string; tone: 'good' | 'warn' | 'bad' | 'muted' } {
  if (status === 'sourcing') return { label: 'Sourcing specs…', tone: 'muted' };
  if (status === 'needs_review') return { label: 'Needs review', tone: 'warn' };
  if (complete && (status === 'confirmed' || status === 'manual')) {
    return { label: 'Specs confirmed', tone: 'good' };
  }
  if (complete && status === 'high_confidence') return { label: 'Specs found (unverified)', tone: 'warn' };
  if (complete) return { label: 'Specs confirmed', tone: 'good' };
  if (status === 'not_found') return { label: 'Missing specs — not found online', tone: 'bad' };
  return { label: 'Missing specs', tone: 'bad' };
}
