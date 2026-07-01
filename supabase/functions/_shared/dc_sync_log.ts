// ============================================================
// Dynasty Connect — lead sync logger (Step 5)
// ============================================================
// Append-only instrumentation. NEVER alters lead state. NEVER
// blocks the calling code on logging failure (catch + console).
//
// Insert one row per sync attempt, regardless of success.
// Used by:
//   - sf-trigger-bland-campaign      (direction='in',  source='sf-trigger-bland-campaign')
//   - re-trigger-bland-campaign      (direction='in',  source='re-trigger-bland-campaign')
//   - dc-bland-webhook (SF path)     (direction='out', source='dc-bland-webhook:surplus_funds')
//   - dc-bland-webhook (RE path)     (direction='out', source='dc-bland-webhook:real_estate')
// ============================================================

export interface SyncLogEntry {
  business_unit_key: string;
  lead_id: string;
  dc_lead_id?: string | null;
  sync_direction: 'in' | 'out';
  status_before?: string | null;
  status_after?: string | null;
  sync_source: string;
  success: boolean;
  error_message?: string | null;
}

/** Fire-and-forget log. Returns void; never throws. */
export async function logLeadSync(supabase: any, entry: SyncLogEntry): Promise<void> {
  try {
    await supabase.from('dc_lead_sync_log').insert(entry);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[dc_lead_sync_log] insert failed (non-fatal)', e, entry);
  }
}

/** Bulk variant for trigger functions that fan out N leads in a loop. */
export async function logLeadSyncBatch(supabase: any, entries: SyncLogEntry[]): Promise<void> {
  if (!entries.length) return;
  try {
    await supabase.from('dc_lead_sync_log').insert(entries);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[dc_lead_sync_log] batch insert failed (non-fatal)', e, { count: entries.length });
  }
}

/**
 * Log a per-lead gate-block event. Fires when checkDispatchGates()
 * denies dispatch for a lead (kill-switch, DNC, bad phone, etc.).
 * Emits success=false with the gate reason so blocked leads are
 * distinguishable from successful entry-point rows in the log.
 */
export async function logGateBlock(
  supabase: any,
  args: {
    businessUnitKey: string;
    leadId: string;
    triggerName: string; // e.g. 'dd-trigger-bland-campaign'
    gateCode: string;
    gateReason: string;
    statusBefore?: string | null;
  },
): Promise<void> {
  return logLeadSync(supabase, {
    business_unit_key: args.businessUnitKey,
    lead_id: args.leadId,
    sync_direction: 'in',
    status_before: args.statusBefore ?? null,
    sync_source: `${args.triggerName}:gate_block:${args.gateCode}`,
    success: false,
    error_message: args.gateReason,
  });
}
