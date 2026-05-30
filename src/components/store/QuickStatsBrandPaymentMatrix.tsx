import { useStoreBrandRelationships, BRAND_DISPLAY, type StoreBrandId, type PaymentType } from '@/hooks/useStoreBrandRelationships';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { CANONICAL_BRAND_IDS } from '@/config/brands';

const PAYMENT_LABELS: Record<PaymentType, string> = {
  pay_upfront: 'Pay Upfront',
  bill_to_bill: 'Bill to Bill',
};

interface Props {
  storeId: string;
}

export function QuickStatsBrandPaymentMatrix({ storeId }: Props) {
  const { relationships, isLoading } = useStoreBrandRelationships(storeId);

  const handleScrollToPanel = () => {
    const el = document.querySelector('[data-section="brand-relationships"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Brand Payment Status</p>
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const relMap = new Map(relationships.map(r => [r.brand_id, r]));

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Brand Payment Status</p>
      <div className="space-y-1.5">
        {CANONICAL_BRAND_IDS.map(brandId => {
          const brand = BRAND_DISPLAY[brandId];
          const rel = relMap.get(brandId);
          const isActive = rel ? !['paused', 'terminated'].includes(rel.relationship_health) : false;

          return (
            <div
              key={brandId}
              className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors hover:bg-muted/40 ${
                !isActive ? 'opacity-50' : ''
              }`}
              onClick={handleScrollToPanel}
            >
              <div className="flex items-center gap-2 text-sm">
                <span>{brand.icon}</span>
                <span className={`font-medium ${!isActive ? 'line-through text-muted-foreground' : ''}`}>
                  {brand.name}
                </span>
              </div>
              {rel ? (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    !isActive
                      ? 'bg-muted/50 text-muted-foreground/60 border-border/30'
                      : !rel.payment_type_chosen
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40'
                        : rel.payment_type === 'pay_upfront'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {!isActive ? 'Inactive' : !rel.payment_type_chosen ? 'Neither (set)' : PAYMENT_LABELS[rel.payment_type]}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground/60 border-border/30">
                  Not Configured
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
