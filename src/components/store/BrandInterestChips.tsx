import { Badge } from '@/components/ui/badge';
import { Loader2, ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react';
import { useStoreTubeKPI } from '@/hooks/useStoreTubeKPI';

/**
 * Brand Interest Chips — pinned at top of Store Profile header.
 *
 * Authoritative source: `store_tube_inventory_status.owner_interested`
 * (boolean per brand), surfaced via the existing `useStoreTubeKPI` hook /
 * `v_store_tube_kpi` view. Reuses the cached `['store-tube-kpi', storeId]`
 * query — no new network call.
 *
 * Why this source over alternatives:
 *  - `store_brand_relationships.relationship_health` describes the RELATIONSHIP
 *    state (healthy/at_risk/paused/terminated), not the owner's stated interest.
 *  - `checklist_tube_intelligence.interest` is a per-VISIT signal, not a
 *    per-store rollup — would need a new query and wouldn't represent the
 *    current state of every brand.
 *  - `owner_interested` is the exact semantic ("is the store interested?"),
 *    edited per-brand in `UnifiedTubeIntelligenceCard`, and already cached.
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

export function BrandInterestChips({ storeId }: Props) {
  const { data: kpi = [], isLoading } = useStoreTubeKPI(storeId);

  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }
  if (!kpi.length) return null;

  // Deduplicate by brand_name (the view returns 7 rows incl. dark/light variants)
  const seen = new Set<string>();
  const rows = kpi.filter((r) => {
    if (seen.has(r.brand_name)) return false;
    seen.add(r.brand_name);
    return true;
  });

  const handleScroll = () => {
    const el = document.querySelector('[data-section="brand-relationships"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mr-1">
        Interest:
      </span>
      {rows.map((r) => {
        const kind = classify(r.owner_interested);
        return (
          <Badge
            key={`${r.brand_id}-${r.brand_name}`}
            variant="outline"
            className={`text-xs font-medium cursor-pointer transition-colors gap-1 ${STYLES[kind]}`}
            onClick={handleScroll}
            title={`${r.brand_name}: ${LABELS[kind]}`}
          >
            {ICONS[kind]}
            <span>{r.brand_name}</span>
          </Badge>
        );
      })}
    </div>
  );
}
