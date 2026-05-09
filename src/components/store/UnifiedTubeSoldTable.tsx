import { useStoreTubeBrandsKpi } from '@/hooks/useStoreTubeBrandsKpi';
import { Skeleton } from '@/components/ui/skeleton';

interface Props { storeId: string }

const fmt = (n: number) => Number(n || 0).toLocaleString();

export function UnifiedTubeSoldTable({ storeId }: Props) {
  const { data, isLoading } = useStoreTubeBrandsKpi(storeId);

  if (isLoading) return <Skeleton className="h-24" />;
  const rows = (data || []).filter(r => r.sold_lifetime > 0 || r.on_hand > 0);
  if (rows.length === 0) return null;

  return (
    <div className="border-t pt-3 mt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Per-Brand Sold vs On Hand
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Brand</th>
              <th className="py-1.5 px-3 font-medium text-right text-blue-600">On Hand</th>
              <th className="py-1.5 px-3 font-medium text-right text-red-600">Sold (Lifetime)</th>
              <th className="py-1.5 pl-3 font-medium text-right text-red-500">Sold (30d)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.brand_id || r.brand_name} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-1.5 pr-3 capitalize">{r.brand_name}</td>
                <td className="py-1.5 px-3 text-right font-mono text-blue-600">{fmt(r.on_hand)}</td>
                <td className="py-1.5 px-3 text-right font-mono text-red-600 font-semibold">{fmt(r.sold_lifetime)}</td>
                <td className="py-1.5 pl-3 text-right font-mono text-red-500">{fmt(r.sold_30d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
