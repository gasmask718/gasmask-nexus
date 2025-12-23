import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  User,
  Clock,
  Send,
  FileText,
  Phone,
  Mail,
  MessageSquare,
  Building,
  Tag,
  UserCircle,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { WorkOwnershipActions, PriorityBadge, StatusBadge, SLATimer } from "./WorkOwnershipActions";
import { WorkItem } from "@/hooks/useWorkOwnership";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ThreadMessage {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  channel: string;
  actor_type: "human" | "ai" | "system";
  created_at: string;
  status?: string;
}

interface ThreadDetailPanelProps {
  item: WorkItem;
  messages?: ThreadMessage[];
  onSendMessage?: (content: string) => void;
  onClose?: () => void;
}

export function ThreadDetailPanel({
  item,
  messages = [],
  onSendMessage,
  onClose,
}: ThreadDetailPanelProps) {
  const [replyContent, setReplyContent] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSend = () => {
    if (!replyContent.trim() || !onSendMessage) return;
    onSendMessage(replyContent);
    setReplyContent("");
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "call":
        return Phone;
      case "email":
        return Mail;
      case "sms":
      default:
        return MessageSquare;
    }
  };

  const ChannelIcon = getChannelIcon(item.channel);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ChannelIcon className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold truncate">{item.phone_number || "Unknown"}</span>
              <Badge variant="outline" className="uppercase text-xs">
                {item.channel}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {item.business_id && (
                <>
                  <Building className="h-3 w-3" />
                  <span>{item.business_id}</span>
                  <span>•</span>
                </>
              )}
              <span>{format(new Date(item.created_at), "MMM d, yyyy h:mm a")}</span>
            </div>
          </div>

          <WorkOwnershipActions item={item} />
        </div>

        {/* Status Row */}
        <div className="flex items-center gap-3 mt-3">
          <StatusBadge status={item.status} />
          <PriorityBadge priority={item.priority} />
          <SLATimer deadline={item.sla_deadline} />
          
          {item.escalation_level && item.escalation_level > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Escalation Level {item.escalation_level}
            </Badge>
          )}
        </div>

        {/* Owner */}
        {item.owner_user_id && (
          <div className="flex items-center gap-2 mt-3 text-sm">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            <span>Assigned to: </span>
            <span className="font-medium">Agent</span>
          </div>
        )}
      </div>

      {/* Messages Timeline */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Initial message */}
          <MessageBubble
            direction={item.direction as "inbound" | "outbound"}
            content={item.content || ""}
            actorType={item.actor_type as "human" | "ai" | "system"}
            timestamp={item.created_at}
            channel={item.channel}
          />

          {/* Thread messages */}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              direction={message.direction}
              content={message.content}
              actorType={message.actor_type}
              timestamp={message.created_at}
              channel={message.channel}
              status={message.status}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Reply Area */}
      {onSendMessage && (
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              <FileText className="h-4 w-4 mr-1" />
              Templates
            </Button>
          </div>
          
          <div className="mt-3">
            <Textarea
              placeholder="Type your reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-muted-foreground">
                {replyContent.length} / 160 characters
              </div>
              <Button onClick={handleSend} disabled={!replyContent.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Side Info Panel */}
      <div className="border-t p-4 bg-muted/30">
        <h4 className="font-medium text-sm mb-3">Quick Actions</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="justify-start">
            <Phone className="h-4 w-4 mr-2" />
            Call Back
          </Button>
          <Button variant="outline" size="sm" className="justify-start">
            <Tag className="h-4 w-4 mr-2" />
            Add Tag
          </Button>
          <Button variant="outline" size="sm" className="justify-start">
            <FileText className="h-4 w-4 mr-2" />
            Add Note
          </Button>
          <Button variant="outline" size="sm" className="justify-start">
            <CheckCircle className="h-4 w-4 mr-2" />
            Resolve
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  direction,
  content,
  actorType,
  timestamp,
  channel,
  status,
}: {
  direction: "inbound" | "outbound";
  content: string;
  actorType: "human" | "ai" | "system";
  timestamp: string;
  channel: string;
  status?: string;
}) {
  const isInbound = direction === "inbound";

  return (
    <div className={cn("flex gap-3", !isInbound && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isInbound ? "bg-muted" : "bg-primary/10"
        )}
      >
        {isInbound ? (
          <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
        ) : actorType === "ai" ? (
          <Bot className="h-4 w-4 text-primary" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Message */}
      <div className={cn("flex-1 max-w-[80%]", !isInbound && "text-right")}>
        <div
          className={cn(
            "inline-block p-3 rounded-lg",
            isInbound ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 mt-1 text-xs text-muted-foreground",
            !isInbound && "justify-end"
          )}
        >
          <span>{format(new Date(timestamp), "h:mm a")}</span>
          {actorType === "ai" && (
            <Badge variant="outline" className="text-xs py-0">
              AI
            </Badge>
          )}
          {status && (
            <Badge variant="outline" className="text-xs py-0 capitalize">
              {status}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
