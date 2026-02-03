import { Phone, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ContactLastInteractionProps {
  last_call_attempt_at?: string | null;
  last_call_answered_at?: string | null;
  last_text_sent_at?: string | null;
  last_text_received_at?: string | null;
  className?: string;
}

export function ContactLastInteraction({
  last_call_attempt_at,
  last_call_answered_at,
  last_text_sent_at,
  last_text_received_at,
  className,
}: ContactLastInteractionProps) {
  const formatDate = (date: string | null) => {
    if (!date) return null;
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return null;
    }
  };

  const lastCallDate = formatDate(last_call_attempt_at);
  const callAnswered = last_call_answered_at && last_call_attempt_at && 
    new Date(last_call_answered_at) >= new Date(last_call_attempt_at);
  
  const lastTextDate = formatDate(last_text_sent_at);
  const textReplied = last_text_received_at && last_text_sent_at && 
    new Date(last_text_received_at) >= new Date(last_text_sent_at);

  if (!lastCallDate && !lastTextDate) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Never contacted
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs", className)}>
      {lastCallDate && (
        <div className="flex items-center gap-1">
          <Phone className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">{lastCallDate}</span>
          {callAnswered ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-400" />
          )}
        </div>
      )}
      {lastTextDate && (
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">{lastTextDate}</span>
          {textReplied ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-400" />
          )}
        </div>
      )}
    </div>
  );
}
