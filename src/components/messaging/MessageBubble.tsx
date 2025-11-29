import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, CheckCheck, Star, Languages } from "lucide-react";
import { format } from "date-fns";
import { Message } from "@/services/messaging/useMessaging";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showTranslation?: boolean;
  onToggleTranslation?: () => void;
  onStar?: () => void;
}

export function MessageBubble({
  message,
  isOwn,
  showTranslation,
  onToggleTranslation,
  onStar,
}: MessageBubbleProps) {
  const hasTranslation = Object.keys(message.translated_text || {}).length > 0;
  const isStarred = message.starred_by?.length > 0;

  return (
    <div className={cn("flex flex-col gap-1", isOwn ? "items-end" : "items-start")}>
      {/* Role Badge */}
      {!isOwn && (
        <Badge variant="outline" className="text-xs">
          {message.sender_role}
        </Badge>
      )}

      {/* Message Bubble */}
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 relative group",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm",
          message.is_system_message && "bg-amber-100 dark:bg-amber-900/20 italic",
          message.is_whisper && "bg-purple-100 dark:bg-purple-900/20 border border-dashed"
        )}
      >
        {message.is_whisper && (
          <span className="text-xs text-purple-600 dark:text-purple-400 block mb-1">
            🔒 Internal Note
          </span>
        )}

        <p className="whitespace-pre-wrap break-words">
          {showTranslation && message.translated_text?.en
            ? message.translated_text.en
            : message.message_text}
        </p>

        {/* Attachments */}
        {message.attachments?.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm underline"
              >
                📎 {att.name}
              </a>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="absolute -top-2 right-0 hidden group-hover:flex gap-1">
          {hasTranslation && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleTranslation}
            >
              <Languages className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", isStarred && "text-yellow-500")}
            onClick={onStar}
          >
            <Star className={cn("h-3 w-3", isStarred && "fill-current")} />
          </Button>
        </div>
      </div>

      {/* Meta info */}
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", isOwn && "flex-row-reverse")}>
        <span>{format(new Date(message.created_at), 'h:mm a')}</span>
        {isOwn && (
          message.read_by?.length > 0 ? (
            <CheckCheck className="h-3 w-3 text-blue-500" />
          ) : (
            <Check className="h-3 w-3" />
          )
        )}
      </div>
    </div>
  );
}
