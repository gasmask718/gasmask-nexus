/**
 * MATERIAL BALANCE CARD
 * "What do we still hold?" — issued vs consumed per material, quantities only.
 *
 * RBAC: this card intentionally NEVER renders cost columns
 * (total_issued_cost exists on the view but is manager-only data).
 * Safe for office leaders.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scale } from 'lucide-react';
import { useOfficeMaterialBalance } from '@/hooks/useProductionPortal';
import { useTranslation } from '@/hooks/useTranslation';

const MATERIAL_LABELS: Record<string, string> = {
  tobacco: 'Tobacco',
  tobacco_lbs: 'Tobacco',
  tubes: 'Tubes',
  stickers: 'Stickers',
  bags: 'Bags',
  boxes: 'Boxes',
  other: 'Other',
};

export function MaterialBalanceCard({ officeId }: { officeId: string }) {
  const { t } = useTranslation();
  const { data: rows = [], isLoading } = useOfficeMaterialBalance(officeId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          {t('production.material_balance')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('production.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('production.no_materials_yet')}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-4 text-[10px] uppercase tracking-wide text-muted-foreground pb-1 border-b">
              <span>{t('production.type')}</span>
              <span className="text-right">{t('production.issued')}</span>
              <span className="text-right">{t('production.used')}</span>
              <span className="text-right">{t('production.on_hand')}</span>
            </div>
            {rows.map((r) => {
              const low = r.expected_on_hand <= 0;
              return (
                <div key={`${r.material_type}-${r.brand ?? ''}`} className="grid grid-cols-4 items-center text-sm">
                  <span className="flex items-center gap-1">
                    {MATERIAL_LABELS[r.material_type] || r.material_type}
                    {r.brand && <Badge variant="outline" className="text-[9px]">{r.brand}</Badge>}
                  </span>
                  <span className="text-right font-mono">{Number(r.total_issued).toLocaleString()}</span>
                  <span className="text-right font-mono">{Number(r.total_consumed).toLocaleString()}</span>
                  <span className={`text-right font-mono font-semibold ${low ? 'text-destructive' : ''}`}>
                    {Number(r.expected_on_hand).toLocaleString()}
                    {r.unit ? <span className="text-[10px] text-muted-foreground ml-1">{r.unit}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MaterialBalanceCard;
