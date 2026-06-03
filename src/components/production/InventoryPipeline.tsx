/**
 * INVENTORY PIPELINE VISUALIZATION
 * Shows batch inventory states as a visual pipeline with counts per state.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Factory } from 'lucide-react';
import { INVENTORY_STATES, type InventoryState } from '@/hooks/useInventoryState';
import { useTodayBatches } from '@/hooks/useProductionPortal';
import { cn } from '@/lib/utils';

interface InventoryPipelineProps {
  officeId: string;
}

export function InventoryPipeline({ officeId }: InventoryPipelineProps) {
  const { t } = useTranslation();
  const { data: batches = [] } = useTodayBatches(officeId);

  // Count batches in each state
  const stateCounts: Record<string, number> = {};
  for (const state of INVENTORY_STATES) {
    stateCounts[state.value] = 0;
  }
  for (const batch of batches) {
    const state = (batch as any).inventory_state || 'raw';
    stateCounts[state] = (stateCounts[state] || 0) + 1;
  }

  const totalBatches = batches.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Factory className="h-4 w-4" />
          <BilingualLabel tKey="production.inventory_pipeline" en="Inventory Pipeline" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalBatches === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("production.no_batches_today_pipeline")}
          </p>
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {INVENTORY_STATES.map((state, idx) => {
              const count = stateCounts[state.value] || 0;
              const pct = totalBatches > 0 ? Math.round((count / totalBatches) * 100) : 0;

              return (
                <div key={state.value} className="flex items-center">
                  <div
                    className={cn(
                      'rounded-lg border px-4 py-3 min-w-[110px] text-center transition-all',
                      count > 0 ? state.color : 'bg-muted/30 text-muted-foreground border-muted'
                    )}
                  >
                    <div className="text-lg mb-1">{state.icon}</div>
                    <p className="text-xs font-medium">{state.label}</p>
                    <p className="text-xl font-bold">{count}</p>
                    {totalBatches > 0 && (
                      <p className="text-xs text-muted-foreground">{pct}%</p>
                    )}
                  </div>
                  {idx < INVENTORY_STATES.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Hard Gate Indicator */}
        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <span>🔒</span>
          <span>
            <strong><BilingualLabel tKey="production.hard_gate" en="Hard Gate:" inline /></strong> CRM and distribution can only see batches in "Approved" or "Sent to Office" state.
            Currently <strong>{(stateCounts['approved'] || 0) + (stateCounts['sent_to_office'] || 0)}</strong> batch(es) available.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
