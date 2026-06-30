// ============================================================
// Dynasty Connect — pre-dial dispatch gates
// ============================================================
// Single chokepoint for kill-switch + calling-hours + throttle
// enforcement. Imported by:
//   - dc-outbound-call (primary per-call entrypoint)
//   - dc-bland-dispatch (direct Bland API paths)
//   - dc-bulk-call (launch + per-batch enforcement)
//
// Decisions confirmed by user (batch 2026-06-30):
//   * No-schedule default = PERMISSIVE (allow dispatch)
//   * Schedule overlap   = PARALLEL OVERRIDE
//                           (dc_campaign_schedules wins; dc_campaigns
//                            legacy cols are NOT auto-read here — if
//                            you want legacy fallback, add it inside
//                            getEffectiveSchedule)
//   * Kill-switch scope  = BOTH (campaign-scoped + business-unit-scoped)
//   * Throttle mechanism = DB count against dc_call_logs (only viable
//                            in serverless edge without persistent memory;
//                            ~1-call race window is acceptable)
// ============================================================

export type GateBlockCode =
  | 'kill_switch_campaign'
  | 'kill_switch_business_unit'
  | 'outside_calling_hours'
  | 'throttle_hourly_cap'
  | 'throttle_concurrent_cap';

export type GateResult =
  | { allowed: true }
  | { allowed: false; code: GateBlockCode; reason: string; retryable: boolean };

export interface GateContext {
  campaignId?: string | null;
  businessUnitKey?: string | null;
}

// Public helper. Returns the first failing gate, or { allowed: true }.
// Order:
//   1. kill_switch_state (campaign first, then business_unit)
//   2. calling hours / days-of-week (skips if no schedule row → PERMISSIVE)
//   3. throttle caps (only if schedule defines them)
export async function checkDispatchGates(
  supabase: any,
  ctx: GateContext,
): Promise<GateResult> {
  // ---- 1. KILL SWITCH ----------------------------------------------------
  if (ctx.campaignId) {
    const { data } = await supabase
      .from('kill_switch_state')
      .select('id, trigger_reason')
      .eq('campaign_id', ctx.campaignId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        allowed: false,
        code: 'kill_switch_campaign',
        reason: `Campaign kill-switch engaged${data.trigger_reason ? `: ${data.trigger_reason}` : ''}`,
        retryable: false,
      };
    }
  }
  if (ctx.businessUnitKey) {
    const { data } = await supabase
      .from('kill_switch_state')
      .select('id, trigger_reason')
      .eq('business_unit_key', ctx.businessUnitKey)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        allowed: false,
        code: 'kill_switch_business_unit',
        reason: `Business-unit kill-switch engaged for ${ctx.businessUnitKey}${data.trigger_reason ? `: ${data.trigger_reason}` : ''}`,
        retryable: false,
      };
    }
  }

  // ---- 2. SCHEDULE LOOKUP ------------------------------------------------
  const schedule = await getEffectiveSchedule(supabase, ctx);
  // No schedule = PERMISSIVE per user decision.
  if (!schedule) return { allowed: true };

  // ---- 2a. CALLING HOURS / DAYS-OF-WEEK ---------------------------------
  const now = new Date();
  const tz = schedule.timezone || 'America/New_York';
  // Intl.DateTimeFormat returns short weekday and hour/minute in target TZ.
  // We map weekday string to 0=Sun..6=Sat to match days_of_week int[].
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = wdMap[parts.find((p) => p.type === 'weekday')?.value || ''];
  const hh = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const mm = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  // Normalize Intl 24h='24' → 0 (some runtimes return 24 at midnight)
  const hour24 = hh === 24 ? 0 : hh;
  const nowMinutes = hour24 * 60 + mm;

  const daysAllowed: number[] = Array.isArray(schedule.days_of_week) ? schedule.days_of_week : [];
  if (daysAllowed.length > 0 && typeof wd === 'number' && !daysAllowed.includes(wd)) {
    return {
      allowed: false,
      code: 'outside_calling_hours',
      reason: `Today (weekday ${wd}) not in days_of_week for schedule (tz=${tz})`,
      retryable: true, // lead is not permanently blocked
    };
  }

  const start = parseTimeToMinutes(schedule.calling_hours_start);
  const end = parseTimeToMinutes(schedule.calling_hours_end);
  if (start !== null && end !== null) {
    // Standard non-overnight window (start < end). If a user creates an
    // overnight window (e.g. 22:00 → 06:00) this evaluates as a single
    // 8-hour interval split across midnight, which is correctly rejected.
    const inWindow = start <= end
      ? (nowMinutes >= start && nowMinutes < end)
      : (nowMinutes >= start || nowMinutes < end);
    if (!inWindow) {
      return {
        allowed: false,
        code: 'outside_calling_hours',
        reason: `Current time ${pad(hour24)}:${pad(mm)} (${tz}) outside ${schedule.calling_hours_start}–${schedule.calling_hours_end}`,
        retryable: true,
      };
    }
  }

  // ---- 2b. THROTTLE CAPS ------------------------------------------------
  // Race-window caveat: two parallel invocations can each pass the check
  // and over-dial by 1. Acceptable per user decision; advisory locks would
  // be the hard-correct upgrade.
  if (schedule.max_calls_per_hour && ctx.campaignId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('dc_call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', ctx.campaignId)
      .gte('created_at', oneHourAgo);
    if ((count ?? 0) >= schedule.max_calls_per_hour) {
      return {
        allowed: false,
        code: 'throttle_hourly_cap',
        reason: `Hourly cap reached (${count}/${schedule.max_calls_per_hour}) for campaign ${ctx.campaignId}`,
        retryable: true,
      };
    }
  }
  if (schedule.max_concurrent_calls && ctx.campaignId) {
    const { count } = await supabase
      .from('dc_call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', ctx.campaignId)
      .in('status', ['in_progress', 'dialing', 'initiated', 'calling']);
    if ((count ?? 0) >= schedule.max_concurrent_calls) {
      return {
        allowed: false,
        code: 'throttle_concurrent_cap',
        reason: `Concurrent cap reached (${count}/${schedule.max_concurrent_calls}) for campaign ${ctx.campaignId}`,
        retryable: true,
      };
    }
  }

  return { allowed: true };
}

// Schedule resolution: prefer the campaign-scoped row, fall back to the
// business-unit-scoped one. Returns null if nothing applies.
async function getEffectiveSchedule(supabase: any, ctx: GateContext): Promise<any | null> {
  if (ctx.campaignId) {
    const { data } = await supabase
      .from('dc_campaign_schedules')
      .select('*')
      .eq('campaign_id', ctx.campaignId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  if (ctx.businessUnitKey) {
    const { data } = await supabase
      .from('dc_campaign_schedules')
      .select('*')
      .eq('business_unit_key', ctx.businessUnitKey)
      .is('campaign_id', null)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

function parseTimeToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mi)) return null;
  return h * 60 + mi;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
