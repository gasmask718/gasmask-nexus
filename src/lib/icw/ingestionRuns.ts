// ═══════════════════════════════════════════════════════════════════════════
// ICW INGESTION RUN LOGGING — writes icw_ingestion_runs
// ═══════════════════════════════════════════════════════════════════════════
// Every batch ingest (business leads or candidate leads) opens a run row before
// the first write and closes it with real counts afterwards. A crashed run is
// closed with outcome 'failed' + error_detail, so a run that never finished is
// visible rather than silently absent.

import { supabase } from '@/integrations/supabase/client';
import { verifiedInsert, verifiedUpdate } from '@/lib/verifiedMutation';

export interface ICWIngestionRun {
  id: string;
  source: string | null;
  query_term: string | null;
  geography: string | null;
  category: string | null;
  started_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  raw_result_count: number;
  new_lead_count: number;
  duplicate_count: number;
  error_detail: string | null;
  created_at: string;
}

export interface StartRunInput {
  source: string;
  query_term?: string | null;
  geography?: string | null;
  category?: string | null;
}

export interface RunCounts {
  raw_result_count: number;
  new_lead_count: number;
  duplicate_count: number;
}

/** Opens a run row (outcome 'running') and returns it. */
export async function startIngestionRun(input: StartRunInput): Promise<ICWIngestionRun> {
  const rows = await verifiedInsert<ICWIngestionRun>('start ICW ingestion run', () =>
    supabase.from('icw_ingestion_runs').insert({
      source: input.source,
      query_term: input.query_term ?? null,
      geography: input.geography ?? null,
      category: input.category ?? null,
      started_at: new Date().toISOString(),
      outcome: 'running',
      raw_result_count: 0,
      new_lead_count: 0,
      duplicate_count: 0,
    } as never),
  );
  return rows[0];
}

/** Closes a run row with final counts. */
export async function completeIngestionRun(
  runId: string,
  counts: RunCounts,
  outcome: 'success' | 'failed' = 'success',
  errorDetail?: string | null,
): Promise<void> {
  await verifiedUpdate<ICWIngestionRun>('complete ICW ingestion run', () =>
    supabase
      .from('icw_ingestion_runs')
      .update({
        ...counts,
        outcome,
        error_detail: errorDetail ?? null,
        completed_at: new Date().toISOString(),
      } as never)
      .eq('id', runId),
  );
}
