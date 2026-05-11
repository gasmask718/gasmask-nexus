/**
 * useNumberLastSessions — fetches the most recent VA session per Twilio number
 * from the brandaro_number_last_sessions view (sourced from dc_phone_numbers
 * + va_sessions). Returns a Map keyed by number_id for O(1) lookup, plus the
 * raw rows for tabular views.
 *
 * Used by:
 *   - VAOnboardingModal (shows "Last used by", "Last used", "Duration", "Currently Active")
 *   - LastUserLogsTable (admin audit log on /crm/brandaro)
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NumberLastSession {
  number_id: string;
  phone_number: string;
  friendly_name: string | null;
  business: string | null;
  in_use: boolean | null;
  assigned_va_id: string | null;
  session_id: string | null;
  last_va_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  session_active: boolean | null;
  va_email?: string | null;
}

export function useNumberLastSessions() {
  return useQuery({
    queryKey: ['brandaro-number-last-sessions'],
    refetchInterval: 15_000,
    queryFn: async (): Promise<{ rows: NumberLastSession[]; byId: Map<string, NumberLastSession> }> => {
      const { data, error } = await (supabase as any)
        .from('brandaro_number_last_sessions')
        .select('*')
        .order('started_at', { ascending: false, nullsFirst: false });
      if (error) throw error;

      const base = (data ?? []) as NumberLastSession[];
      const vaIds = Array.from(new Set(base.map((r) => r.last_va_id).filter(Boolean))) as string[];

      let emailMap = new Map<string, string | null>();
      if (vaIds.length) {
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('id, email')
          .in('id', vaIds);
        (profiles ?? []).forEach((p: any) => emailMap.set(p.id, p.email));
      }

      const enriched = base.map((r) => ({
        ...r,
        va_email: r.last_va_id ? emailMap.get(r.last_va_id) ?? null : null,
      }));

      const byId = new Map<string, NumberLastSession>();
      enriched.forEach((r) => byId.set(r.number_id, r));
      return { rows: enriched, byId };
    },
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function formatDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '—';
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const sec = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
