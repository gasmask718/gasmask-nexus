import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Handshake } from 'lucide-react';
import {
  useStoreBrandRelationships,
  BRAND_DISPLAY,
  StoreBrandId,
  PaymentType,
  RelationshipHealth,
  StoreBrandRelationship,
} from '@/hooks/useStoreBrandRelationships';


const PAYMENT_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: 'pay_upfront', label: 'Pay Upfront' },
  { value: 'bill_to_bill', label: 'Bill to Bill' },
];

const HEALTH_OPTIONS: { value: RelationshipHealth; label: string; variant: string }[] = [
  { value: 'healthy', label: 'Healthy', variant: 'text-green-400' },
  { value: 'at_risk', label: 'At Risk', variant: 'text-amber-400' },
  { value: 'trialing', label: 'Trialing', variant: 'text-blue-400' },
  { value: 'paused', label: 'Paused', variant: 'text-orange-400' },
  { value: 'terminated', label: 'Terminated', variant: 'text-red-400' },
];

interface Props {
  storeId: string;
}

export function BrandRelationshipsPanel({ storeId }: Props) {
  const { relationships, isLoading, updateRelationship } = useStoreBrandRelationships(storeId);

  if (isLoading) {
    return (
      <Card className="border-border/40 bg-card/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 bg-card/50" data-section="brand-relationships">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="h-4 w-4 text-primary" />
          Brand Relationships
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {relationships.map((rel) => (
          <BrandRow key={rel.id} rel={rel} onUpdate={updateRelationship} />
        ))}
        {relationships.length === 0 && (
          <p className="text-sm text-muted-foreground">No brand relationships found.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BrandRow({
  rel,
  onUpdate,
}: {
  rel: StoreBrandRelationship;
  onUpdate: (args: { id: string; updates: Partial<StoreBrandRelationship> }) => void;
}) {
  const brand = BRAND_DISPLAY[rel.brand_id as StoreBrandId];
  if (!brand) return null;

  const healthInfo = HEALTH_OPTIONS.find((h) => h.value === rel.relationship_health);

  return (
    <div className="rounded-lg border border-border/30 bg-background/50 p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{brand.icon}</span>
          <span className="font-medium text-sm">{brand.name}</span>
          {healthInfo && (
            <span className={`text-xs font-medium ${healthInfo.variant}`}>
              • {healthInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Payment</label>
          <Select
            value={rel.payment_type_chosen ? rel.payment_type : 'unset'}
            onValueChange={(v) => {
              if (v === 'unset') {
                onUpdate({ id: rel.id, updates: { payment_type_chosen: false } });
              } else {
                onUpdate({ id: rel.id, updates: { payment_type: v as PaymentType, payment_type_chosen: true } });
              }
            }}
          >
            <SelectTrigger className={`h-8 text-xs ${!rel.payment_type_chosen ? 'border-amber-500/50 text-amber-600 dark:text-amber-400' : ''}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset" className="text-xs text-amber-600 dark:text-amber-400">
                Neither / Not set — choose one
              </SelectItem>
              {PAYMENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Health</label>
          <Select
            value={rel.relationship_health}
            onValueChange={(v) =>
              onUpdate({ id: rel.id, updates: { relationship_health: v as RelationshipHealth } })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEALTH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
