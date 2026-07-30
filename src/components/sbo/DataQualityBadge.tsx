import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Quality = 'full' | 'partial' | 'odds_only' | string | null | undefined;

const MAP: Record<string, { label: string; short: string; icon: string; cls: string; tip: string }> = {
  full: {
    label: 'Full Stats',
    short: '📊',
    icon: '✅',
    cls: 'text-green-500 border-green-500/40',
    tip: 'Backed by real player game logs and season stats.',
  },
  partial: {
    label: 'Partial Stats',
    short: '⚠️',
    icon: '⚠️',
    cls: 'text-yellow-500 border-yellow-500/40',
    tip: 'Some real stats available, but coverage is incomplete.',
  },
  odds_only: {
    label: 'Odds-Only — Limited Data',
    short: '🔴',
    icon: '🔴',
    cls: 'text-destructive border-destructive/40',
    tip: 'No real stats feed for this sport/player. Prediction is derived from the betting line alone — confidence is capped and this is NOT comparable to calibrated output.',
  },
};

function resolve(quality: Quality) {
  if (!quality) return MAP.odds_only;
  return MAP[quality] ?? MAP.odds_only;
}

/** Emoji-only variant for dense rows. */
export function DataQualityDot({ quality }: { quality: Quality }) {
  const q = resolve(quality);
  return <span title={q.tip}>{q.short}</span>;
}

export function DataQualityBadge({
  quality,
  className = '',
  compact = false,
}: {
  quality: Quality;
  className?: string;
  compact?: boolean;
}) {
  const q = resolve(quality);
  const badge = (
    <Badge
      variant="outline"
      className={`${compact ? 'text-[8px] h-4 px-1' : 'text-[10px] h-5 px-1.5'} ${q.cls} ${className}`}
    >
      {q.icon} {compact && quality === 'odds_only' ? 'Odds Only' : q.label}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{badge}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-xs">{q.tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default DataQualityBadge;
