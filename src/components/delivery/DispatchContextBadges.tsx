// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCH CONTEXT BADGES — Phase 3.3 Portal Awareness
// ═══════════════════════════════════════════════════════════════════════════════
// Shows "why this stop was dispatched" from route_stops metadata only.
// No Floor 1 queries. Read-only display.

import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DispatchContextBadgesProps {
  notesToWorker: string | null;
  brandId: string | null;
  opportunityIds: string[] | null;
  orderIds: string[] | null;
}

export function DispatchContextBadges({
  notesToWorker,
  brandId,
  opportunityIds,
  orderIds,
}: DispatchContextBadgesProps) {
  const hasOpportunities = opportunityIds && opportunityIds.length > 0;
  const hasOrders = orderIds && orderIds.length > 0;

  // Parse notes_to_worker for dispatch signals
  const notes = notesToWorker?.toLowerCase() || '';
  const needsOrder = notes.includes('order') || notes.includes('process order');
  const needsSamples = notes.includes('sample');
  const needsKit = notes.includes('starter kit') || notes.includes('kit');
  const hasFollowUp = notes.includes('follow-up') || notes.includes('follow up');

  const hasAnyContext = hasOpportunities || hasOrders || needsOrder || needsSamples || needsKit || hasFollowUp || brandId;

  if (!hasAnyContext) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {needsOrder && (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-primary/30">
          <Package className="h-2.5 w-2.5 mr-0.5" />
          Order
        </Badge>
      )}
      {needsSamples && (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-secondary text-secondary-foreground">
          Samples
        </Badge>
      )}
      {needsKit && (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-accent text-accent-foreground">
          Kit
        </Badge>
      )}
      {hasOpportunities && (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-muted text-muted-foreground">
          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
          {opportunityIds!.length} Opp
        </Badge>
      )}
      {hasFollowUp && (
        <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          FU
        </Badge>
      )}
      {brandId && (
        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
          {brandId}
        </Badge>
      )}
    </div>
  );
}
