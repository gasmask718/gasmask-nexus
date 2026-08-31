/**
 * VARebuttals — DB-backed objection rebuttals for the ACTIVE VA company.
 * Brandaro reads brandaro_closer_rebuttals; every other company reads the
 * shared va_call_rebuttals table (see useVACompanyRebuttals).
 */
import { useVASession } from '@/contexts/VASessionContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useVACompanyRebuttals } from '@/hooks/useVACompanyScript';

interface VARebuttalsProps {
  companySlug?: string | null;
}

export function VARebuttals({ companySlug }: VARebuttalsProps = {}) {
  const { t } = useVASession();
  const { data, isLoading } = useVACompanyRebuttals(companySlug);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full bg-slate-700/40" />
        <Skeleton className="h-16 w-full bg-slate-700/40" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">{t('va.rebuttals.title')}</h3>
      {(data || []).map((r) => (
        <div key={r.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-orange-400">"{r.label}"</span>
          </div>
          {r.human_response && (
            <p className="text-sm text-slate-300 leading-relaxed mb-2">{r.human_response}</p>
          )}
          {r.soft_rebuttal && (
            <p className="text-[11px] text-slate-400 italic border-l-2 border-slate-600 pl-2 mb-1">
              <span className="text-slate-500 not-italic">Soft: </span>{r.soft_rebuttal}
            </p>
          )}
          {r.aggressive_rebuttal && (
            <p className="text-[11px] text-rose-300/80 italic border-l-2 border-rose-500/40 pl-2">
              <span className="text-rose-400 not-italic">Aggressive: </span>{r.aggressive_rebuttal}
            </p>
          )}
        </div>
      ))}
      {(data || []).length === 0 && (
        <div className="text-xs text-slate-400 text-center py-4">
          No rebuttals configured.
        </div>
      )}
    </div>
  );
}
