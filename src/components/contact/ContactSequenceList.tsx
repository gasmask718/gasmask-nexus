/**
 * ContactSequenceList — Phase III AI-Recommended Contact Sequencing
 * 
 * Ranked list: "1. John Smith — Text · replied 2d ago"
 * Advisory only. Explainable on hover.
 */

import { MessageSquare, Phone, HelpCircle, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ContactSequenceEntry } from '@/hooks/usePredictiveContactIntelligence';
import { cn } from '@/lib/utils';

interface ContactSequenceListProps {
  sequence: ContactSequenceEntry[] | undefined;
  maxVisible?: number;
  className?: string;
}

export function ContactSequenceList({ sequence, maxVisible = 3, className }: ContactSequenceListProps) {
  if (!sequence || sequence.length === 0) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <HelpCircle className="h-3 w-3" />
        <span>No contacts to sequence</span>
      </div>
    );
  }

  const visible = sequence.slice(0, maxVisible);
  const remaining = sequence.length - maxVisible;

  return (
    <TooltipProvider>
      <div className={cn('space-y-1.5', className)}>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-medium">Recommended Contact Order</span>
        </div>
        <div className="space-y-1 pl-1">
          {visible.map((entry) => (
            <ContactSequenceRow key={entry.contact_id} entry={entry} />
          ))}
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground pl-5">
              + {remaining} more contact{remaining > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function ContactSequenceRow({ entry }: { entry: ContactSequenceEntry }) {
  const ChannelIcon = entry.suggested_channel === 'text' ? MessageSquare
    : entry.suggested_channel === 'call' ? Phone
    : HelpCircle;

  const channelLabel = entry.suggested_channel === 'text' ? 'Text'
    : entry.suggested_channel === 'call' ? 'Call'
    : 'Unknown';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 text-xs p-1.5 rounded-md hover:bg-muted/30 transition-colors cursor-default">
          <span className="w-4 text-right font-semibold text-muted-foreground shrink-0">
            {entry.rank}.
          </span>
          <span className="font-medium truncate max-w-[120px]">{entry.name}</span>
          <span className="text-muted-foreground">—</span>
          <ChannelIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{channelLabel}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground truncate">
            {entry.last_response_relative === 'No responses yet'
              ? 'No history'
              : entry.last_response_relative}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px]">
        <p className="text-xs">{entry.reason}</p>
        {entry.phone && <p className="text-xs text-muted-foreground mt-0.5">{entry.phone}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
