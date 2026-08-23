/**
 * VAScripts — DB-backed call script steps.
 * Single source of truth: brandaro_sales_script_steps (same table powering
 * the dashboard's Scripts & Rebuttals panel).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVASession } from '@/contexts/VASessionContext';
import { Skeleton } from '@/components/ui/skeleton';

interface VAScriptsProps {
  /** Active VA company slug — scripts only exist for Brandaro today */
  companySlug?: string | null;
  companyName?: string | null;
}

export function VAScripts({ companySlug, companyName }: VAScriptsProps = {}) {
  const { t } = useVASession();
  const scriptsConfigured = !companySlug || companySlug === 'brandaro';
  const { data, isLoading } = useQuery({
    queryKey: ['brandaro-script-steps'],
    enabled: scriptsConfigured,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_sales_script_steps')
        .select('*')
        .eq('is_active', true)
        .eq('is_current', true)
        .order('step_number');
      return data || [];
    },
  });

  if (!scriptsConfigured) {
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

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full bg-slate-700/40" />
        <Skeleton className="h-20 w-full bg-slate-700/40" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">{t('va.scripts.title')}</h3>
      <p className="text-[11px] text-slate-400 -mt-2">
        Read naturally — don't sound like a robot. Pause for their answers.
      </p>
      {(data || []).map((s: any) => (
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
      {(data || []).length === 0 && (
        <div className="text-xs text-slate-400 text-center py-4">
          No active script steps. Add some in the Scripts & Rebuttals admin.
        </div>
      )}
    </div>
  );
}
