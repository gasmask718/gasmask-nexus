/**
 * useVACompanyScript / useVACompanyRebuttals
 *
 * One reader for VA call scripts across companies:
 *  - Brandaro keeps its established tables (brandaro_sales_script_steps /
 *    brandaro_closer_rebuttals) so nothing about that lane changes.
 *  - Every other company reads the shared va_call_scripts / va_call_rebuttals
 *    tables, keyed by va_companies.slug. GasMask content lives there.
 *
 * Both shapes are normalised so VAScripts / VARebuttals /
 * VAScriptsRebuttalsPanel can render either without branching.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VAScriptStep {
  id: string;
  step_number: number;
  step_name: string;
  display_label: string | null;
  va_says: string;
  coaching_tip: string | null;
}

export interface VARebuttal {
  id: string;
  label: string;
  human_response: string | null;
  soft_rebuttal: string | null;
  aggressive_rebuttal: string | null;
}

const BRANDARO = 'brandaro';

export function useVACompanyScript(companySlug: string | null | undefined) {
  const slug = companySlug ?? BRANDARO;
  return useQuery({
    queryKey: ['va-company-script', slug],
    queryFn: async (): Promise<VAScriptStep[]> => {
      if (slug === BRANDARO) {
        const { data } = await (supabase as any)
          .from('brandaro_sales_script_steps')
          .select('id, step_number, step_name, display_label, va_says, coaching_tip')
          .eq('is_active', true)
          .eq('is_current', true)
          .order('step_number');
        return (data || []) as VAScriptStep[];
      }
      const { data } = await (supabase as any)
        .from('va_call_scripts')
        .select('id, step_number, step_name, display_label, va_says, coaching_tip')
        .eq('company_slug', slug)
        .eq('is_active', true)
        .order('step_number');
      return (data || []) as VAScriptStep[];
    },
  });
}

export function useVACompanyRebuttals(companySlug: string | null | undefined) {
  const slug = companySlug ?? BRANDARO;
  return useQuery({
    queryKey: ['va-company-rebuttals', slug],
    queryFn: async (): Promise<VARebuttal[]> => {
      if (slug === BRANDARO) {
        const { data } = await (supabase as any)
          .from('brandaro_closer_rebuttals')
          .select('id, label, human_response, soft_rebuttal, aggressive_rebuttal')
          .eq('is_current', true)
          .order('label');
        return (data || []) as VARebuttal[];
      }
      const { data } = await (supabase as any)
        .from('va_call_rebuttals')
        .select('id, label, human_response, soft_rebuttal, aggressive_rebuttal')
        .eq('company_slug', slug)
        .eq('is_active', true)
        .order('sort_order');
      return (data || []) as VARebuttal[];
    },
  });
}
