import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useSupplierProductScorecard } from '@/hooks/useSupplierIntelligence';
import { AlertTriangle } from 'lucide-react';

const actionColors = {
  seek_alternative: 'bg-red-100 text-red-800',
  renegotiate: 'bg-orange-100 text-orange-800',
  monitor_closely: 'bg-yellow-100 text-yellow-800',
  preferred_supplier: 'bg-green-100 text-green-800',
};

const rowBgColor = {
  seek_alternative: 'bg-red-50',
  renegotiate: 'bg-orange-50',
  monitor_closely: 'bg-yellow-50',
  preferred_supplier: 'bg-green-50',
};

export function SupplierProductRiskTable({ supplier }: { supplier: string }) {
  const { data, isLoading } = useSupplierProductScorecard(supplier);

  if (!supplier) return null;

  if (isLoading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading product details…</CardContent></Card>;
  }

  if (!data?.length) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">No product data for this supplier.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          {supplier} — Product Risk Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Risk Score</TableHead>
              <TableHead>Risk Band</TableHead>
              <TableHead className="text-right">Drift %</TableHead>
              <TableHead className="text-right">Volatility %</TableHead>
              <TableHead className="text-right">Receipts</TableHead>
              <TableHead>Recommended Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((product: any, idx: number) => (
              <TableRow 
                key={idx}
                className={rowBgColor[product.recommended_action as keyof typeof rowBgColor]}
              >
                <TableCell className="font-medium">{product.product_name}</TableCell>
                <TableCell className="text-right font-semibold">{Number(product.risk_score || 0).toFixed(1)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {product.risk_band}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">{Number(product.pct_change || 0).toFixed(2)}%</TableCell>
                <TableCell className="text-right text-sm">{Number(product.volatility_pct || 0).toFixed(2)}%</TableCell>
                <TableCell className="text-right text-sm">{product.receipts_count}</TableCell>
                <TableCell>
                  <Badge className={actionColors[product.recommended_action as keyof typeof actionColors] || 'bg-slate-100'}>
                    {product.recommended_action?.replace(/_/g, ' ')}
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
