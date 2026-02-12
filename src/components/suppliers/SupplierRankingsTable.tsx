import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useSupplierRankings } from '@/hooks/useSupplierIntelligence';
import { Trophy } from 'lucide-react';

const riskBandVariants = {
  healthy: 'bg-green-100 text-green-800',
  watch: 'bg-yellow-100 text-yellow-800',
  risk: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export function SupplierRankingsTable() {
  const { data, isLoading } = useSupplierRankings();

  if (isLoading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading rankings…</CardContent></Card>;
  }

  if (!data?.length) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">No supplier rankings yet.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Supplier Rankings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Overall Score</TableHead>
              <TableHead className="text-right">Avg Risk</TableHead>
              <TableHead className="text-right">Avg Drift %</TableHead>
              <TableHead className="text-right">Avg Volatility %</TableHead>
              <TableHead>Risk Band</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((supplier: any) => (
              <TableRow key={supplier.supplier_name}>
                <TableCell className="font-semibold text-lg">{supplier.rank_overall}</TableCell>
                <TableCell className="font-medium">{supplier.supplier_name}</TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold">{Number(supplier.overall_score).toFixed(1)}</span>
                </TableCell>
                <TableCell className="text-right text-sm">{Number(supplier.avg_risk_score || 0).toFixed(1)}</TableCell>
                <TableCell className="text-right text-sm">{Number(supplier.avg_pct_change || 0).toFixed(2)}%</TableCell>
                <TableCell className="text-right text-sm">{Number(supplier.avg_volatility_pct || 0).toFixed(2)}%</TableCell>
                <TableCell>
                  <Badge className={riskBandVariants[supplier.dominant_risk_band as keyof typeof riskBandVariants] || 'bg-slate-100'}>
                    {supplier.dominant_risk_band}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
