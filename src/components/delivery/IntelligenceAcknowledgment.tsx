// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENCE ACKNOWLEDGMENT UI
// Phase 3.25 — Operator acknowledgment and review tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, CheckCheck, MessageSquare, Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// ACKNOWLEDGMENT BADGE
// ═══════════════════════════════════════════════════════════════════════════════

interface AcknowledgmentBadgeProps {
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  note?: string;
  compact?: boolean;
}

export function AcknowledgmentBadge({ 
  acknowledged, 
  acknowledgedAt, 
  acknowledgedBy,
  note,
  compact = false 
}: AcknowledgmentBadgeProps) {
  if (!acknowledged) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-dashed">
        <Eye className="h-3 w-3 mr-1" />
        {!compact && 'Pending Review'}
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCheck className="h-3 w-3 mr-1" />
            {!compact && 'Reviewed'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Acknowledged</p>
          {acknowledgedAt && (
            <p className="text-xs text-muted-foreground">
              {new Date(acknowledgedAt).toLocaleString()}
            </p>
          )}
          {note && (
            <p className="text-xs mt-1 max-w-[200px]">{note}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACKNOWLEDGMENT BUTTON
// ═══════════════════════════════════════════════════════════════════════════════

interface AcknowledgeButtonProps {
  acknowledged: boolean;
  onAcknowledge: (note?: string) => void;
  isLoading?: boolean;
  size?: 'sm' | 'default';
}

export function AcknowledgeButton({ 
  acknowledged, 
  onAcknowledge, 
  isLoading = false,
  size = 'sm' 
}: AcknowledgeButtonProps) {
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [note, setNote] = useState('');

  const handleQuickAcknowledge = () => {
    onAcknowledge();
  };

  const handleAcknowledgeWithNote = () => {
    onAcknowledge(note);
    setShowNoteDialog(false);
    setNote('');
  };

  if (acknowledged) {
    return (
      <Button variant="ghost" size={size} disabled className="text-green-600">
        <CheckCheck className="h-4 w-4 mr-1" />
        Acknowledged
      </Button>
    );
  }

  return (
    <>
      <div className="flex gap-1">
        <Button 
          variant="outline" 
          size={size}
          onClick={handleQuickAcknowledge}
          disabled={isLoading}
        >
          <Check className="h-4 w-4 mr-1" />
          Acknowledge
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowNoteDialog(true)}
                disabled={isLoading}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add note</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge with Note</DialogTitle>
            <DialogDescription>
              Add context for why you're proceeding despite the signals
            </DialogDescription>
          </DialogHeader>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Conflict is acceptable due to store relationship"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAcknowledgeWithNote} disabled={isLoading}>
              Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEWED CARD WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

interface ReviewedCardWrapperProps {
  children: React.ReactNode;
  acknowledged: boolean;
  acknowledgedAt?: string;
  className?: string;
}

export function ReviewedCardWrapper({ 
  children, 
  acknowledged,
  acknowledgedAt,
  className 
}: ReviewedCardWrapperProps) {
  return (
    <div className={cn(
      'relative',
      acknowledged && 'ring-2 ring-green-500/20 rounded-lg',
      className
    )}>
      {acknowledged && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge variant="outline" className="bg-background text-green-600 border-green-500/30 text-xs">
            <CheckCheck className="h-3 w-3 mr-1" />
            Reviewed
          </Badge>
        </div>
      )}
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY TIMELINE INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

interface HistoryTimelineProps {
  hasHistory: boolean;
  recordCount: number;
  trend?: 'improving' | 'stable' | 'declining';
}

export function HistoryTimelineIndicator({ 
  hasHistory, 
  recordCount,
  trend 
}: HistoryTimelineProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  if (!hasHistory) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-dashed">
        <Clock className="h-3 w-3 mr-1" />
        First observation
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn(getTrendColor())}>
            <Clock className="h-3 w-3 mr-1" />
            {recordCount} prior observations
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Historical tracking active</p>
          <p className="text-xs text-muted-foreground">
            {trend === 'improving' && 'Efficiency is improving over time'}
            {trend === 'declining' && 'Efficiency has declined recently'}
            {trend === 'stable' && 'Efficiency is stable'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
