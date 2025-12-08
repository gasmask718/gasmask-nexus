import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Phone, MessageSquare, Mail, Clock, AlertTriangle, 
  Handshake, Bot, User, ArrowDownLeft, ArrowUpRight,
  Eye, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { UnifiedInboxItem, InboxItemType, InboxSentiment, InboxPriority } from "@/hooks/useUnifiedInbox";

interface InboxItemCardProps {
  item: UnifiedInboxItem;
  isSelected: boolean;
  onClick: () => void;
}

const typeIcons: Record<InboxItemType, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  "follow-up": <Clock className="h-4 w-4" />,
  alert: <AlertTriangle className="h-4 w-4" />,
  negotiation: <Handshake className="h-4 w-4" />,
};

const typeColors: Record<InboxItemType, string> = {
  call: "bg-green-500/10 text-green-600 dark:text-green-400",
  sms: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  email: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "follow-up": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  alert: "bg-red-500/10 text-red-600 dark:text-red-400",
  negotiation: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
};

const sentimentColors: Record<InboxSentiment, string> = {
  positive: "bg-green-500/10 text-green-600",
  neutral: "bg-gray-500/10 text-gray-600",
  negative: "bg-red-500/10 text-red-600",
  urgent: "bg-orange-500/10 text-orange-600",
};

const priorityColors: Record<InboxPriority, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

export function InboxItemCard({ item, isSelected, onClick }: InboxItemCardProps) {
  const timeAgo = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true });

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 border-b cursor-pointer transition-all duration-200 hover:bg-muted/50",
        isSelected && "bg-primary/5 border-l-4 border-l-primary",
        item.requires_action && !isSelected && "bg-amber-50/50 dark:bg-amber-950/10"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Business Avatar */}
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
          style={{ backgroundColor: item.business?.primary_color || "#6366f1" }}
        >
          {item.business?.name?.charAt(0) || "?"}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-sm truncate">
                {item.store?.store_name || item.phone_number || "Unknown"}
              </span>
              {item.ai_flag ? (
                <Bot className="h-3 w-3 text-primary flex-shrink-0" />
              ) : (
                <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {timeAgo}
            </span>
          </div>

          {/* Business + Vertical Row */}
          <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
            <span>{item.business?.name}</span>
            {item.vertical && (
              <>
                <span>•</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {item.vertical.name}
                </Badge>
              </>
            )}
          </div>

          {/* Summary */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {item.summary}
          </p>

          {/* Badges Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type Badge */}
            <Badge variant="secondary" className={cn("text-xs gap-1", typeColors[item.type])}>
              {typeIcons[item.type]}
              <span className="capitalize">{item.type}</span>
            </Badge>

            {/* Direction */}
            <Badge variant="outline" className="text-xs gap-1">
              {item.direction === "inbound" ? (
                <ArrowDownLeft className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowUpRight className="h-3 w-3 text-blue-500" />
              )}
              {item.direction}
            </Badge>

            {/* Sentiment */}
            {item.sentiment && (
              <Badge variant="secondary" className={cn("text-xs", sentimentColors[item.sentiment])}>
                {item.sentiment}
              </Badge>
            )}

            {/* Priority */}
            {item.priority_level === "high" && (
              <Badge className={cn("text-xs", priorityColors[item.priority_level])}>
                High Priority
              </Badge>
            )}

            {/* Requires Action */}
            {item.requires_action && (
              <Badge variant="destructive" className="text-xs">
                Action Needed
              </Badge>
            )}
          </div>
        </div>

        {/* Unread Indicator */}
        {item.requires_action && (
          <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-1" />
        )}
      </div>
    </div>
  );
}
