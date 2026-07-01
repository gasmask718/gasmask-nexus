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

// ============================================================
// Dynasty Connect — immutable compliance event logger
// ============================================================
// Fire-and-forget audit ledger writes to dc_compliance_events.
// Same guarantees as logLeadSync: never throws, never blocks.
// INSERT policy on the table is service_role only, so callers
// must use a service-role client.
// ============================================================

export interface ComplianceEventEntry {
  event_type: string;
  business_unit_key?: string | null;
  lead_id?: string | null;
  source_table?: string | null;
  call_id?: string | null;
  actor?: string;
  actor_user_id?: string | null;
  event_data?: Record<string, unknown>;
  occurred_at?: string;
}

export async function logComplianceEvent(
  supabase: any,
  event: ComplianceEventEntry,
): Promise<void> {
  try {
    const { error } = await supabase.from('dc_compliance_events').insert({
      event_type: event.event_type,
      business_unit_key: event.business_unit_key ?? null,
      lead_id: event.lead_id ?? null,
      source_table: event.source_table ?? null,
      call_id: event.call_id ?? null,
      actor: event.actor ?? 'system',
      actor_user_id: event.actor_user_id ?? null,
      event_data: event.event_data ?? {},
      occurred_at: event.occurred_at ?? new Date().toISOString(),
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[dc_compliance_events] insert failed (non-fatal)', error.message, event);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dc_compliance_events] insert threw (non-fatal)', err, event);
  }
}

