// ═══════════════════════════════════════════════════════════════
// Visit History Card — Shows deterministic post-visit summaries
// Expandable list of past visits with derived intelligence
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useVisitSummaries } from '@/hooks/useVisitSummary';
import { ClipboardList, ChevronDown, ChevronRight, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisitSummaryCardProps {
  storeId: string;
}

export function VisitSummaryCard({ storeId }: VisitSummaryCardProps) {
  const { data: summaries, isLoading } = useVisitSummaries(storeId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-muted rounded w-1/3" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summaries || summaries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Visit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No visit summaries yet. Summaries are auto-generated when a delivery checklist is completed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Visit History
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {summaries.length} visit(s)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {summaries.map((summary: any) => (
          <VisitSummaryRow key={summary.id} summary={summary} />
        ))}
      </CardContent>
    </Card>
  );
}

function VisitSummaryRow({ summary }: { summary: any }) {
  const [open, setOpen] = useState(false);
  const sections = summary.summary_sections || {};

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left">
          <div className="shrink-0">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {new Date(summary.visit_date).toLocaleDateString()}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {summary.source === 'checklist_derived' ? 'Auto' : summary.source}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {summary.summary_text}
            </p>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-7 mt-1 mb-2 space-y-1.5 text-xs">
          {sections.inventory && (
            <div className="flex items-start gap-2 p-2 rounded bg-muted/20">
              <span>📦</span>
              <span>{sections.inventory}</span>
            </div>
          )}
          {sections.orders && (
            <div className="flex items-start gap-2 p-2 rounded bg-muted/20">
              <span>🚚</span>
              <span>{sections.orders}</span>
            </div>
          )}
          {sections.growth && (
            <div className="flex items-start gap-2 p-2 rounded bg-muted/20">
              <span>🌱</span>
              <span>{sections.growth}</span>
            </div>
          )}
          {sections.contacts && (
            <div className="flex items-start gap-2 p-2 rounded bg-muted/20">
              <span>📞</span>
              <span>{sections.contacts}</span>
            </div>
          )}
          {sections.stickers && (
            <div className="flex items-start gap-2 p-2 rounded bg-muted/20">
              <span>🏷️</span>
              <span>{sections.stickers}</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
