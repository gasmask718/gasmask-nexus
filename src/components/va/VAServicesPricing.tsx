/**
 * VAServicesPricing — DB-backed packages list.
 * Single source of truth: brandaro_packages (same table powering the
 * dashboard's Scripts & Rebuttals → Packages tab).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Package } from 'lucide-react';

export function VAServicesPricing() {
  const { data, isLoading } = useQuery({
    queryKey: ['brandaro-packages'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full bg-slate-700/40" />
        <Skeleton className="h-24 w-full bg-slate-700/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          Services & Pricing — What We Offer
        </h3>
        <p className="text-[11px] text-slate-400">
          Reference instantly while on the call.
        </p>
      </div>

      <div className="space-y-2">
        {(data || []).map((p: any) => (
          <div
            key={p.id}
            className={`rounded-lg p-3 border ${
              p.is_target
                ? 'border-cyan-400/60 bg-cyan-500/5'
                : 'border-slate-700/50 bg-slate-900/40'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-cyan-300" />
                <h4 className="text-sm font-bold text-white capitalize">{p.package_name}</h4>
                {p.is_target && (
                  <Badge className="bg-cyan-500 text-white text-[9px] px-1.5 py-0">TARGET</Badge>
                )}
              </div>
              <span className="text-cyan-300 font-bold text-sm">{p.price}</span>
            </div>
            {p.payment_terms && (
              <div className="text-[11px] text-slate-400 mb-1">{p.payment_terms}</div>
            )}
            {p.included_highlights && (
              <div className="text-xs text-slate-200 leading-relaxed">{p.included_highlights}</div>
            )}
            {p.best_for && (
              <div className="text-[11px] text-slate-500 italic mt-1">Best for: {p.best_for}</div>
            )}
          </div>
        ))}
        {(data || []).length === 0 && (
          <div className="text-xs text-slate-400 text-center py-4">
            No packages configured.
          </div>
        )}
      </div>
    </div>
  );
}
