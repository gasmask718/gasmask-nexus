import { Badge } from '@/components/ui/badge';
import { useStoreBrandRelationships, BRAND_DISPLAY, StoreBrandId, PaymentType } from '@/hooks/useStoreBrandRelationships';
import { Loader2 } from 'lucide-react';

const PAYMENT_LABELS: Record<PaymentType, string> = {
  pay_upfront: 'Pay Upfront',
  bill_to_bill: 'Bill to Bill',
  net7: 'Net 7',
  net14: 'Net 14',
  cod: 'COD',
};

const PAYMENT_STYLES: Record<PaymentType, string> = {
  pay_upfront: 'bg-green-500/15 text-green-400 border-green-500/30',
  bill_to_bill: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  net7: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  net14: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  cod: 'bg-muted text-muted-foreground border-border',
};

interface Props {
  storeId: string;
}

export function BrandPaymentQuickStats({ storeId }: Props) {
  const { relationships, isLoading } = useStoreBrandRelationships(storeId);

  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }

  if (!relationships.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {relationships.map((rel) => {
        const brand = BRAND_DISPLAY[rel.brand_id as StoreBrandId];
        if (!brand) return null;

        const isActive = !['paused', 'terminated'].includes(rel.relationship_health);

        return (
          <Badge
            key={rel.id}
            variant="outline"
            className={`text-xs font-medium ${
              isActive
                ? PAYMENT_STYLES[rel.payment_type]
                : 'bg-muted/50 text-muted-foreground/60 border-border/30 line-through'
            }`}
          >
            <span className="mr-1">{brand.icon}</span>
            {brand.name} — {isActive ? PAYMENT_LABELS[rel.payment_type] : 'Inactive'}
          </Badge>
        );
      })}
    </div>
  );
}
