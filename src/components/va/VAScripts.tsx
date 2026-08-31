/**
 * VAScripts — DB-backed call script steps for the ACTIVE VA company.
 * Brandaro reads brandaro_sales_script_steps; every other company reads the
 * shared va_call_scripts table (see useVACompanyScript).
 */
import { useVASession } from '@/contexts/VASessionContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useVACompanyScript } from '@/hooks/useVACompanyScript';

interface VAScriptsProps {
  /** Active VA company slug */
  companySlug?: string | null;
  companyName?: string | null;
}

export function VAScripts({ companySlug, companyName }: VAScriptsProps = {}) {
  const { t } = useVASession();
  const { data, isLoading } = useVACompanyScript(companySlug);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full bg-slate-700/40" />
        <Skeleton className="h-20 w-full bg-slate-700/40" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-6 space-y-1">
        <p className="text-sm text-slate-300">
          No script configured for {companyName ?? 'this company'} yet.
        </p>
        <p className="text-[11px] text-slate-500">
          The owner can add one from the Scripts &amp; Rebuttals admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">{t('va.scripts.title')}</h3>
      <p className="text-[11px] text-slate-400 -mt-2">
        Read naturally — don't sound like a robot. Pause for their answers.
      </p>
      {data.map((s) => (
        <div key={s.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-cyan-400 uppercase">
              Step {s.step_number} — {s.display_label || s.step_name}
            </span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed mb-2 whitespace-pre-wrap">
            {s.va_says}
          </p>
          {s.coaching_tip && (
            <p className="text-[11px] text-amber-300/80 italic border-l-2 border-amber-500/40 pl-2">
              💡 {s.coaching_tip}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
