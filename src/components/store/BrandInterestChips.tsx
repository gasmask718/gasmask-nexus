import { Badge } from '@/components/ui/badge';
import { Loader2, ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react';
import { useStoreTubeKPI, type StoreTubeKPIRow } from '@/hooks/useStoreTubeKPI';
import { useTubeIntelligence, type TubeIntelStatus, type TubeIntelRole } from '@/hooks/useTubeIntelligence';
import { CANONICAL_TUBE_SKUS } from '@/lib/inventory/skuDisplay';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

/**
 * Brand Interest Chips — pinned at top of Store Profile, also serves as the
 * "Interest tab products at top" header strip (#11). Renders ALL canonical
 * SKUs with current interest state. Tap to cycle:
 *   unknown → interested → not_interested → unknown
 * Uses store_tube_inventory_status via useTubeIntelligence.updateField, so
 * existing role-based field governance + audit trail apply.
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

const NEXT: Record<Interest, boolean | null> = {
  unknown: true,
  interested: false,
  not_interested: null,
};

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

const SKU_ALIASES: Record<string, string[]> = {
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

const TOGGLE_ROLES: TubeIntelRole[] = ['admin', 'va', 'ambassador', 'biker'];

function matchAliases<T extends { brand_id?: string | null; brand_name?: string | null }>(
  displayName: string,
  rows: T[]
): T | undefined {
  const aliases = SKU_ALIASES[displayName] ?? [displayName.toLowerCase()];
  return rows.find((r) => {
    const id = (r.brand_id ?? '').toLowerCase().trim();
    const name = (r.brand_name ?? '').toLowerCase().trim();
    return aliases.includes(id) || aliases.includes(name);
  });
}

export function BrandInterestChips({ storeId }: Props) {
  const { data: kpi = [], isLoading } = useStoreTubeKPI(storeId);
  const { data: intel = [], updateField } = useTubeIntelligence(storeId);
  const { role } = useUserRole();
  const canToggle = TOGGLE_ROLES.includes(role as TubeIntelRole);

  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }

  const handleToggle = (sku: { display: string; product_id: string }) => {
    if (!canToggle) return;
    const intelRow = matchAliases(sku.display, intel as TubeIntelStatus[]);
    const current = classify(intelRow?.owner_interested);
    const nextValue = NEXT[current];
    // Use a canonical brand_id when no row exists yet (first alias).
    const brandId =
      intelRow?.brand_id ?? (SKU_ALIASES[sku.display]?.[0] ?? sku.display.toLowerCase());
    updateField.mutate({
      id: intelRow?.id,
      store_id: storeId,
      brand_id: brandId,
      field: 'owner_interested',
      value: nextValue,
      update_method: 'in_person',
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1" data-section="interest-strip">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mr-1">
        Interest:
      </span>
      {CANONICAL_TUBE_SKUS.map((sku) => {
        const intelRow = matchAliases(sku.display, intel as TubeIntelStatus[]);
        const kpiRow = matchAliases(sku.display, kpi as StoreTubeKPIRow[]);
        const ownerInterested = intelRow?.owner_interested ?? kpiRow?.owner_interested;
        const kind = classify(ownerInterested);
        const title = canToggle
          ? `${sku.display}: ${LABELS[kind]} — tap to cycle`
          : `${sku.display}: ${LABELS[kind]}`;
        return (
          <Badge
            key={sku.product_id}
            variant="outline"
            role={canToggle ? 'button' : undefined}
            tabIndex={canToggle ? 0 : undefined}
            className={cn(
              'text-xs font-medium transition-colors gap-1',
              STYLES[kind],
              canToggle ? 'cursor-pointer' : 'cursor-default opacity-90'
            )}
            onClick={() => handleToggle(sku)}
            onKeyDown={(e) => {
              if (!canToggle) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle(sku);
              }
            }}
            title={title}
          >
            {ICONS[kind]}
            <span>{sku.display}</span>
          </Badge>
        );
      })}
    </div>
  );
}
