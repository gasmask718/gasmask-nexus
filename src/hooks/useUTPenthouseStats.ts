// ═══════════════════════════════════════════════════════════════════════════
// UT-019 — Live Penthouse stats. Every number here comes from a real query.
// ALWAYS filter duplicate_of IS NULL (flagged duplicate rows must not count).
// ═══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UTPenthouseStats {
  totalLeads: number;
  contacted: number;
  interested: number;
  onboarded: number;
  needsEnrichment: number;
  callbacksDue: number;
  states: number;
  cities: number;
  partners: number;
  duplicates: number;
  conversionRate: number;
}

const base = () =>
  (supabase.from('ut_partner_leads' as any) as any).select('*', { count: 'exact', head: true }).is('duplicate_of', null);

async function countOf(build: (q: any) => any): Promise<number> {
  const { count, error } = await build(base());
  if (error) throw error;
  return count || 0;
}

export function useUTPenthouseStats() {
  return useQuery<UTPenthouseStats>({
    queryKey: ['ut-penthouse-stats'],
    staleTime: 60_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      const [totalLeads, contacted, interested, onboarded, needsEnrichment, callbacksDue] = await Promise.all([
        countOf((q: any) => q),
        countOf((q: any) => q.not('last_contacted_at', 'is', null)),
        countOf((q: any) => q.eq('status', 'interested')),
        countOf((q: any) => q.not('onboarded_at', 'is', null)),
        countOf((q: any) => q.eq('status', 'needs_enrichment')),
        countOf((q: any) => q.lte('callback_due_at', nowIso)),
      ]);

      const { count: duplicates, error: dErr } = await (supabase.from('ut_partner_leads' as any) as any)
        .select('*', { count: 'exact', head: true })
        .not('duplicate_of', 'is', null);
      if (dErr) throw dErr;

      const { count: partners, error: pErr } = await (supabase.from('ut_partners' as any) as any)
        .select('*', { count: 'exact', head: true });
      if (pErr) throw pErr;

      // Distinct geography
      const { data: geo, error: gErr } = await (supabase.from('ut_partner_leads' as any) as any)
        .select('state, city')
        .is('duplicate_of', null)
        .range(0, 9999);
      if (gErr) throw gErr;

      const states = new Set((geo || []).map((r: any) => r.state).filter(Boolean)).size;
      const cities = new Set(
        (geo || []).map((r: any) => (r.city ? `${r.state || ''}|${r.city}` : null)).filter(Boolean)
      ).size;

      return {
        totalLeads,
        contacted,
        interested,
        onboarded,
        needsEnrichment,
        callbacksDue,
        states,
        cities,
        partners: partners || 0,
        duplicates: duplicates || 0,
        conversionRate: totalLeads > 0 ? (onboarded / totalLeads) * 100 : 0,
      };
    },
  });
}
