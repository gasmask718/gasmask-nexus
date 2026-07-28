import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Phone, MessageSquare, CheckCircle2, XCircle, HelpCircle, AlertTriangle, PhoneOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { isBadNumber, normalizePhoneStatus, PHONE_STATUS_META } from "@/lib/phoneStatus";

interface ContactResponsivenessBadgeProps {
  responsiveness_status: 'responsive' | 'unresponsive' | 'unknown' | 'wrong_number' | 'not_active' | null;
  responsive_by_call?: boolean | null;
  responsive_by_text?: boolean | null;
  last_call_attempt_at?: string | null;
  last_call_answered_at?: string | null;
  last_text_sent_at?: string | null;
  last_text_received_at?: string | null;
  total_calls_attempted?: number;
  total_calls_answered?: number;
  total_texts_sent?: number;
  total_texts_received?: number;
  compact?: boolean;
}

export function ContactResponsivenessBadge({
  responsiveness_status,
  responsive_by_call,
  responsive_by_text,
  last_call_attempt_at,
  last_call_answered_at,
  last_text_sent_at,
  last_text_received_at,
  total_calls_attempted = 0,
  total_calls_answered = 0,
  total_texts_sent = 0,
  total_texts_received = 0,
  compact = false,
}: ContactResponsivenessBadgeProps) {
  // Strict: only truly-responsive when flag === true AND channel evidence exists.
  const callResponsive = responsive_by_call === true && !!last_call_answered_at;
  const textResponsive = responsive_by_text === true && !!last_text_received_at;
  const isResponsive = callResponsive || textResponsive;
  const hasAttempts = (total_calls_attempted || 0) > 0 || (total_texts_sent || 0) > 0;
  const derivedStatus: 'responsive' | 'unresponsive' | 'unknown' = isResponsive
    ? 'responsive'
    : hasAttempts
      ? 'unresponsive'
      : 'unknown';
  // A manually-set BAD NUMBER always wins over evidence-derived responsiveness:
  // the line itself is dead/wrong, so retry evidence is meaningless.
  const stored = normalizePhoneStatus(responsiveness_status);
  const badNumber = isBadNumber(responsiveness_status);
  const status: 'responsive' | 'unresponsive' | 'unknown' | 'wrong_number' | 'not_active' =
    badNumber ? stored : derivedStatus;

  const statusConfig = {
    responsive: {
      label: 'Responsive',
      color: 'bg-green-500/10 text-green-600 border-green-500/30',
      icon: CheckCircle2,
    },
    unresponsive: {
      label: 'Not Responsive',
      color: 'bg-red-500/10 text-red-600 border-red-500/30',
      icon: XCircle,
    },
    unknown: {
      label: 'No Attempts',
      color: 'bg-muted text-muted-foreground border-border',
      icon: HelpCircle,
    },
    wrong_number: {
      label: PHONE_STATUS_META.wrong_number.label,
      color: PHONE_STATUS_META.wrong_number.className,
      icon: AlertTriangle,
    },
    not_active: {
      label: PHONE_STATUS_META.not_active.label,
      color: PHONE_STATUS_META.not_active.className,
      icon: PhoneOff,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const tooltipContent = (
    <div className="space-y-2 text-xs">
      <div className="font-semibold border-b pb-1 mb-2">Communication Summary</div>
      {badNumber && (
        <div className="rounded border border-red-500/40 bg-red-500/10 p-1.5 text-red-600">
          {config.label} — excluded from all retry / follow-up / auto-outreach queues. Needs a new number.
        </div>
      )}

      
      <div className="flex items-center gap-2">
        <Phone className="h-3 w-3" />
        <span className="font-medium">Calls:</span>
        <span>{total_calls_answered}/{total_calls_attempted} answered</span>
      </div>
      <div className="text-muted-foreground ml-5">
        Last attempt: {formatDate(last_call_attempt_at)}
        {last_call_answered_at && (
          <><br />Last answered: {formatDate(last_call_answered_at)}</>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <MessageSquare className="h-3 w-3" />
        <span className="font-medium">Texts:</span>
        <span>{total_texts_received}/{total_texts_sent} replied</span>
      </div>
      <div className="text-muted-foreground ml-5">
        Last sent: {formatDate(last_text_sent_at)}
        {last_text_received_at && (
          <><br />Last reply: {formatDate(last_text_received_at)}</>
        )}
      </div>

      <div className="border-t pt-2 mt-2 flex gap-3">
        <div className="flex items-center gap-1">
          <Phone className={`h-3 w-3 ${callResponsive ? 'text-green-500' : 'text-muted-foreground'}`} />
          <span className={callResponsive ? 'text-green-600' : 'text-muted-foreground'}>
            {callResponsive ? 'Answers' : 'No answer'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className={`h-3 w-3 ${textResponsive ? 'text-green-500' : 'text-muted-foreground'}`} />
          <span className={textResponsive ? 'text-green-600' : 'text-muted-foreground'}>
            {textResponsive ? 'Replies' : 'No reply'}
          </span>
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <StatusIcon className={`h-4 w-4 ${
                status === 'responsive' ? 'text-green-500' :
                status === 'unresponsive' ? 'text-red-500' :
                'text-muted-foreground'
              }`} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-xs ${config.color} cursor-help`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
