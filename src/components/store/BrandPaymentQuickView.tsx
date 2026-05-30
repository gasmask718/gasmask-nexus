import { Badge } from '@/components/ui/badge';
import { useStoreBrandRelationships, BRAND_DISPLAY, StoreBrandId, PaymentType } from '@/hooks/useStoreBrandRelationships';
import { Loader2 } from 'lucide-react';

const PAYMENT_LABELS: Record<PaymentType, string> = {
  pay_upfront: 'Pay Upfront',
  bill_to_bill: 'Bill to Bill',
};

const PAYMENT_STYLES: Record<PaymentType, string> = {
  pay_upfront: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
  bill_to_bill: 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25',
};

interface Props {
  storeId: string;
}

export function BrandPaymentQuickView({ storeId }: Props) {
  const { relationships, isLoading } = useStoreBrandRelationships(storeId);

  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }

  if (!relationships.length) return null;

  const handleScrollToPanel = () => {
    const el = document.querySelector('[data-section="brand-relationships"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {relationships.map((rel) => {
        const brand = BRAND_DISPLAY[rel.brand_id as StoreBrandId];
        if (!brand) return null;

        const isActive = !['paused', 'terminated'].includes(rel.relationship_health);
        const isUnset = !rel.payment_type_chosen;

        return (
          <Badge
            key={rel.id}
            variant="outline"
            className={`text-xs font-medium cursor-pointer transition-colors ${
              !isActive
                ? 'bg-muted/50 text-muted-foreground/60 border-border/30 line-through'
                : isUnset
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/25'
                  : PAYMENT_STYLES[rel.payment_type]
            }`}
            onClick={handleScrollToPanel}
          >
            <span className="mr-1">{brand.icon}</span>
            {brand.name} — {!isActive ? 'Inactive' : isUnset ? 'Neither (set)' : PAYMENT_LABELS[rel.payment_type]}
          </Badge>
        );
      })}
    </div>
  );
}
