import { Badge } from '@/components/ui/badge';
import { Loader2, ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react';
import { useStoreTubeKPI, type StoreTubeKPIRow } from '@/hooks/useStoreTubeKPI';
import { CANONICAL_TUBE_SKUS } from '@/lib/inventory/skuDisplay';

/**
 * Brand Interest Chips — pinned at top of Store Profile header.
 *
 * Renders ALL 9 canonical product SKUs (CANONICAL_TUBE_SKUS) with their
 * operator-facing display names. Looks up per-product owner interest from
 * v_store_tube_kpi (owner_interested boolean). Missing rows render as
 * 'Unknown' so the catalog is always complete.
 */

interface Props {
  storeId: string;
}

type Interest = 'interested' | 'not_interested' | 'unknown';

function classify(owner_interested: boolean | null | undefined): Interest {
  if (owner_interested === true) return 'interested';
  if (owner_interested === false) return 'not_interested';
  return 'unknown';
}

const STYLES: Record<Interest, string> = {
  interested:
    'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25',
  not_interested:
    'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20',
  unknown:
    'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted/60',
};

const ICONS: Record<Interest, JSX.Element> = {
  interested: <ThumbsUp className="h-3 w-3" />,
  not_interested: <ThumbsDown className="h-3 w-3" />,
  unknown: <HelpCircle className="h-3 w-3" />,
};

const LABELS: Record<Interest, string> = {
  interested: 'Interested',
  not_interested: 'Not Interested',
  unknown: 'Unknown',
};

// Canonical display name → list of KPI brand_id aliases (lowercased) that
// represent the same SKU in v_store_tube_kpi.
const SKU_KPI_ALIASES: Record<string, string[]> = {
  'GasMask Tubes': ['gasmasktubes', 'gasmask tubes'],
  'GasMask Bags': ['gasmask', 'gasmaskbags', 'gasmask bags'],
  'GasMask Redtops': ['gasmaskredtops', 'gasmask redtops'],
  'Hotscolatti Mix': ['hotscalati', 'hotscolatti', 'hotscolatti mix', 'hotscalatimixpack'],
  'Hotscolatti Dark': ['hotscolatti-dark', 'hotscolattidark', 'hotscalatidark', 'hot scolatti dark'],
  'Hotscolatti Light': ['hotscolatti-light', 'hotscolattilight', 'hotscalatilight', 'hot scolatti light'],
  'Hotscolatti Bros': ['hotscalatibros', 'hotscolattibros', 'hotscolatti bros'],
  HotMama: ['hotmama', 'hot mama'],
  'Grabba R Us': ['grabba_r_us', 'grabba', 'grabbarus', 'grabba r us'],
};

function findKpiRow(displayName: string, kpi: StoreTubeKPIRow[]): StoreTubeKPIRow | undefined {
  const aliases = SKU_KPI_ALIASES[displayName] ?? [displayName.toLowerCase()];
  return kpi.find((r) => {
    const id = (r.brand_id ?? '').toLowerCase().trim();
    const name = (r.brand_name ?? '').toLowerCase().trim();
    return aliases.includes(id) || aliases.includes(name);
  });
}

export function BrandInterestChips({ storeId }: Props) {
  const { data: kpi = [], isLoading } = useStoreTubeKPI(storeId);

  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }

  const handleScroll = () => {
    const el = document.querySelector('[data-section="brand-relationships"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mr-1">
        Interest:
      </span>
      {CANONICAL_TUBE_SKUS.map((sku) => {
        const row = findKpiRow(sku.display, kpi);
        const kind = classify(row?.owner_interested);
        return (
          <Badge
            key={sku.product_id}
            variant="outline"
            className={`text-xs font-medium cursor-pointer transition-colors gap-1 ${STYLES[kind]}`}
            onClick={handleScroll}
            title={`${sku.display}: ${LABELS[kind]}`}
          >
            {ICONS[kind]}
            <span>{sku.display}</span>
          </Badge>
        );
      })}
    </div>
  );
}
