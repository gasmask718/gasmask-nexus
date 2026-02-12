import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, Truck, DollarSign } from 'lucide-react';

interface SupplierLeverageSummaryProps {
  primaryRiskDriver?: string;
  volatility?: number;
  forecast_pct_increase?: number;
  reliability?: number;
}

const leverageMap: Record<string, { icon: any; options: string[] }> = {
  forecast_increase: {
    icon: TrendingUp,
    options: [
      'Long-term fixed pricing contract (12+ months)',
      'Pricing band anchored to commodity index',
      'Tiered volume discounts to offset increases',
      'Early payment discounts in exchange for price locks',
    ],
  },
  volatility: {
    icon: Zap,
    options: [
      'Quarterly pricing reviews with ±2% caps',
      'Pricing formula (base cost + fixed margin %)',
      'Annual volume commitments to smooth demand',
      'Safety stock agreements to reduce urgency',
    ],
  },
  low_reliability: {
    icon: Truck,
    options: [
      'Formal SLA with on-time delivery minimums (95%+)',
      'Lead time guarantees with financial penalties',
      'Dual sourcing arrangement (split volume)',
      'Expedited order acceptance for emergency needs',
    ],
  },
  margin_pressure: {
    icon: DollarSign,
    options: [
      'Volume-based tiered pricing structure',
      'Product substitution to lower-cost alternatives',
      'SKU consolidation (reduce variety, increase volume)',
      'Annual cost-down negotiations tied to our growth',
    ],
  },
};

function getDrivers(primaryRiskDriver?: string, volatility?: number, forecast?: number, reliability?: number): string[] {
  const drivers: string[] = [];
  if (forecast && forecast > 15) drivers.push('forecast_increase');
  if (volatility && volatility > 0.15) drivers.push('volatility');
  if (reliability && reliability < 0.5) drivers.push('low_reliability');
  if (forecast && forecast > 10) drivers.push('margin_pressure');
  if (primaryRiskDriver && !drivers.includes(primaryRiskDriver)) {
    drivers.push(primaryRiskDriver);
  }
  return drivers.slice(0, 3);
}

export function SupplierLeverageSummary({
  primaryRiskDriver,
  volatility,
  forecast_pct_increase,
  reliability,
}: SupplierLeverageSummaryProps) {
  const drivers = getDrivers(primaryRiskDriver, volatility, forecast_pct_increase, reliability);
  const leverageOptions = drivers
    .map((driver) => leverageMap[driver])
    .filter((opt) => opt);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Leverage & Options</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Risk drivers mapped to negotiation levers</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {leverageOptions.length > 0 ? (
          leverageOptions.map((leverage, idx) => {
            const Icon = leverage.icon;
            return (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">LEVERAGE</span>
                </div>
                <div className="pl-6 space-y-1">
                  {leverage.options.map((option, oidx) => (
                    <Badge key={oidx} variant="outline" className="text-xs mr-2 mb-2">
                      {option}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">No specific leverage identified. Standard relationship management applies.</p>
        )}
      </CardContent>
    </Card>
  );
}
