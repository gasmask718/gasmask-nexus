/**
 * Receipt Status Indicator
 * Displays the delivery status of invoice receipt texts with visual indicators
 * States: not_sent, queued, sent, delivered, failed, suppressed
 */
import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Ban, 
  MessageSquare 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export type ReceiptStatus = 
  | 'not_sent' 
  | 'queued' 
  | 'sent' 
  | 'delivered' 
  | 'failed' 
  | 'suppressed' 
  | 'skipped'
  | null;

export interface ReceiptStatusIndicatorProps {
  status: ReceiptStatus;
  sentAt?: string | null;
  deliveredAt?: string | null;
  failureReason?: string | null;
  phoneUsed?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusConfig: Record<string, {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  not_sent: {
    icon: MessageSquare,
    label: 'Not Sent',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Receipt text has not been sent',
  },
  queued: {
    icon: Clock,
    label: 'Queued',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    description: 'Receipt text is queued for delivery',
  },
  sent: {
    icon: Send,
    label: 'Sent',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    description: 'Receipt text was sent, awaiting delivery confirmation',
  },
  delivered: {
    icon: CheckCircle2,
    label: 'Delivered',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    description: 'Receipt text was delivered to the customer',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    description: 'Receipt text failed to send',
  },
  suppressed: {
    icon: Ban,
    label: 'Suppressed',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Historical record - automation disabled',
  },
  skipped: {
    icon: Ban,
    label: 'Skipped',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Receipt text was intentionally skipped',
  },
};

const sizeClasses = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function ReceiptStatusIndicator({
  status,
  sentAt,
  deliveredAt,
  failureReason,
  phoneUsed,
  size = 'md',
  showLabel = false,
}: ReceiptStatusIndicatorProps) {
  const effectiveStatus = status || 'not_sent';
  const config = statusConfig[effectiveStatus] || statusConfig.not_sent;
  const Icon = config.icon;

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return null;
    try {
      return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    } catch {
      return null;
    }
  };

  const buildTooltipContent = () => {
    const lines: string[] = [config.description];

    if (sentAt) {
      lines.push(`Sent: ${formatTimestamp(sentAt)}`);
    }
    if (deliveredAt) {
      lines.push(`Delivered: ${formatTimestamp(deliveredAt)}`);
    }
    if (phoneUsed) {
      lines.push(`To: ${phoneUsed}`);
    }
    if (failureReason && effectiveStatus === 'failed') {
      lines.push(`Reason: ${failureReason}`);
    }

    return lines;
  };

  const tooltipLines = buildTooltipContent();

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 cursor-help',
            config.bgColor
          )}>
            <Icon className={cn(sizeClasses[size], config.color)} />
            {showLabel && (
              <span className={cn('text-xs font-medium', config.color)}>
                {config.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{config.label}</p>
            {tooltipLines.map((line, i) => (
              <p key={i} className="text-xs text-muted-foreground">{line}</p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact icon-only version for table rows
 */
export function ReceiptStatusIcon({
  status,
  sentAt,
  deliveredAt,
  failureReason,
  phoneUsed,
}: Omit<ReceiptStatusIndicatorProps, 'size' | 'showLabel'>) {
  return (
    <ReceiptStatusIndicator
      status={status}
      sentAt={sentAt}
      deliveredAt={deliveredAt}
      failureReason={failureReason}
      phoneUsed={phoneUsed}
      size="sm"
      showLabel={false}
    />
  );
}
