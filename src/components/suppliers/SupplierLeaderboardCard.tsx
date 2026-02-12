import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSupplierRankings } from '@/hooks/useSupplierIntelligence';
import { Trophy } from 'lucide-react';

export function SupplierLeaderboardCard({ onSelect }: { onSelect: (s: string) => void }) {
  const { data, isLoading } = useSupplierRankings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Supplier Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">No supplier data yet. Scores populate after PO receipts.</p>
        ) : (
          <div className="space-y-2">
            {data.map((s: any) => (
              <div
                key={s.supplier_name}
                className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSelect(s.supplier_name)}
              >
                <div>
                  <p className="font-medium text-sm">{s.supplier_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Products: {s.products_count} · Receipts: {s.total_receipts_count}
                  </p>
                </div>
                <Badge variant={s.overall_score >= 80 ? 'default' : s.overall_score >= 60 ? 'secondary' : 'destructive'}>
                  {Number(s.overall_score).toFixed(1)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
