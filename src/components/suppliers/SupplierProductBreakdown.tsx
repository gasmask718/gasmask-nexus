import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useSupplierProductScorecard } from '@/hooks/useSupplierIntelligence';
import { Package } from 'lucide-react';

export function SupplierProductBreakdown({ supplier }: { supplier: string }) {
  const { data, isLoading } = useSupplierProductScorecard(supplier);

  if (!supplier) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          {supplier} — Product Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">No product scores for this supplier yet.</p>
        ) : (
          <div className="space-y-2">
            {data.map((p: any) => (
              <div key={p.product_id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">{p.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Drift: {p.pct_change}% · Volatility: {p.volatility_pct}%
                  </p>
                </div>
                <p className="font-bold text-sm">{Number(p.overall_score).toFixed(1)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
