import { useStoreLifetimeByBrand } from '@/hooks/useStoreLifetimeByBrand';
import { useStoreSoldByBrandWindow } from '@/hooks/useStoreSoldByBrandWindow';
import { CANONICAL_TUBE_SKUS } from '@/lib/inventory/skuDisplay';
import { Skeleton } from '@/components/ui/skeleton';

interface Props { storeId: string }

const TUBES_PER_BOX = 100;

// Products sold in bags (only GasMask Bags today) — resolved by product_id.
const BAG_PRODUCT_IDS = new Set<string>(['170adb8f-ac4e-40f4-a283-38730d30c5de']);

function unitLabelFor(productId: string): 'bags' | 'tubes' {
  return BAG_PRODUCT_IDS.has(productId) ? 'bags' : 'tubes';
}

function fmtBoxesLoose(units: number, unit: 'bags' | 'tubes'): string {
  if (!units) return '—';
  const boxes = Math.floor(units / TUBES_PER_BOX);
  const loose = units % TUBES_PER_BOX;
  const parts: string[] = [];
  if (boxes) parts.push(`${boxes}b`);
  if (loose) parts.push(`${loose} ${unit === 'bags' ? 'bag' : 'loose'}`);
  return parts.length ? `${parts.join(' + ')} (${units.toLocaleString()} ${unit})` : `${units} ${unit}`;
}

export function UnifiedTubeSoldTable({ storeId }: Props) {
  const lifetime = useStoreLifetimeByBrand(storeId);
  const last30 = useStoreSoldByBrandWindow(storeId, 'last_30_days');

  if (lifetime.isLoading || last30.isLoading) return <Skeleton className="h-24" />;

  const rows = CANONICAL_TUBE_SKUS.map((sku) => {
    const lt = lifetime.data?.find((l) => l.product_id === sku.product_id);
    const l30 = last30.data?.find((w) => w.product_id === sku.product_id);
    const unit = unitLabelFor(sku.product_id);
    return {
      product_id: sku.product_id,
      display: sku.display,
      unit,
      on_hand: lt?.inventory_count ?? 0,
      sold_lifetime: lt?.tubes ?? 0,
      sold_30d: l30?.tubes ?? 0,
    };
  });

  const hasAny = rows.some((r) => r.sold_lifetime > 0 || r.on_hand > 0);
  if (!hasAny) return null;

  return (
    <div className="border-t pt-3 mt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Per-Product Sold vs On Hand
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Product</th>
              <th className="py-1.5 px-3 font-medium">Unit</th>
              <th className="py-1.5 px-3 font-medium text-right text-blue-600">On Hand</th>
              <th className="py-1.5 px-3 font-medium text-right text-red-600">Sold (Lifetime)</th>
              <th className="py-1.5 pl-3 font-medium text-right text-red-500">Sold (30d)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-1.5 pr-3">{r.display}</td>
                <td className="py-1.5 px-3 text-muted-foreground">{r.unit}</td>
                <td className="py-1.5 px-3 text-right font-mono text-blue-600">
                  {fmtBoxesLoose(r.on_hand, r.unit)}
                </td>
                <td className="py-1.5 px-3 text-right font-mono text-red-600 font-semibold">
                  {fmtBoxesLoose(r.sold_lifetime, r.unit)}
                </td>
                <td className="py-1.5 pl-3 text-right font-mono text-red-500">
                  {fmtBoxesLoose(r.sold_30d, r.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
