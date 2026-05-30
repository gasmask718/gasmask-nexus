import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCommunications, useSendCommunication, Communication } from "@/hooks/useCommunications";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { 
  Send, 
  Phone, 
  MessageSquare, 
  Mail, 
  Instagram, 
  Facebook,
  ArrowDownUp,
  Filter,
  Loader2,
  MessageCircle,
  User,
  CheckCheck,
  Check
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { cn } from "@/lib/utils";

interface ConversationInboxProps {
  entityType: 'influencer' | 'ambassador' | 'store' | 'wholesaler' | 'driver' | 'biker';
  entityId: string;
  entityName: string;
  isEditable?: boolean;
}

const channelConfig: Record<string, { icon: any; label: string; color: string }> = {
  email: { icon: Mail, label: 'Email', color: 'text-blue-500' },
  sms: { icon: MessageSquare, label: 'SMS', color: 'text-green-500' },
  call: { icon: Phone, label: 'Phone Call', color: 'text-purple-500' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', color: 'text-emerald-500' },
  instagram_dm: { icon: Instagram, label: 'Instagram DM', color: 'text-pink-500' },
  tiktok_dm: { icon: MessageCircle, label: 'TikTok DM', color: 'text-black dark:text-white' },
  facebook_dm: { icon: Facebook, label: 'Facebook DM', color: 'text-blue-600' },
  twitter_dm: { icon: MessageCircle, label: 'X/Twitter DM', color: 'text-sky-500' },
  other: { icon: MessageCircle, label: 'Other', color: 'text-muted-foreground' },
};

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return `Yesterday ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, yyyy · h:mm a');
}

function getDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function ConversationInbox({ 
  entityType, 
  entityId, 
  entityName,
  isEditable = true 
}: ConversationInboxProps) {
  const { communications, isLoading, error } = useCommunications(entityType, entityId);
  const sendCommunication = useSendCommunication();
  
  const [newMessage, setNewMessage] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string>("sms");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [communications]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    await sendCommunication.mutateAsync({
      entity_type: entityType,
      entity_id: entityId,
      channel: selectedChannel,
      direction: 'outbound',
      message_body: newMessage.trim(),
      sender: 'System User', // Will be replaced with actual user name
      recipient: entityName,
      status: 'sent',
    });

    setNewMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filter communications by channel
  const filteredComms = filterChannel === 'all' 
    ? communications 
    : communications?.filter(c => c.channel === filterChannel);

  // Group by date
  const groupedByDate: Record<string, Communication[]> = {};
  filteredComms?.forEach(comm => {
    const dateKey = format(new Date(comm.occurred_at), 'yyyy-MM-dd');
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(comm);
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton variant="list" count={5} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load conversations"
        description="Unable to load communication history. Please try again."
        actionLabel="Retry"
        onAction={() => window.location.reload()}
      />
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      {/* Header with filters */}
      <CardHeader className="border-b py-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            Conversation History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {Object.entries(channelConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <config.icon className={cn("h-3 w-3", config.color)} />
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {!filteredComms || filteredComms.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={MessageCircle}
              title="No conversations recorded yet"
              description="Start logging communications to build a complete history with this contact."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByDate).map(([dateKey, messages]) => (
              <div key={dateKey}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {getDateSeparator(messages[0].occurred_at)}
                  </span>
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {messages.map((comm) => {
                    const config = channelConfig[comm.channel] || channelConfig.other;
                    const isOutbound = comm.direction === 'outbound';

                    return (
                      <div
                        key={comm.id}
                        className={cn(
                          "flex gap-3",
                          isOutbound ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        {/* Avatar */}
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          isOutbound ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          {isOutbound ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <config.icon className={cn("h-4 w-4", config.color)} />
                          )}
                        </div>

                        {/* Message bubble */}
                        <div className={cn(
                          "max-w-[70%] space-y-1",
                          isOutbound ? "items-end" : "items-start"
                        )}>
                          {/* Header */}
                          <div className={cn(
                            "flex items-center gap-2 text-xs text-muted-foreground",
                            isOutbound ? "flex-row-reverse" : "flex-row"
                          )}>
                            <span className="font-medium">
                              {isOutbound ? comm.sender : comm.sender}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              <config.icon className={cn("h-2.5 w-2.5 mr-1", config.color)} />
                              {config.label}
                            </Badge>
                          </div>

                          {/* Subject if exists */}
                          {comm.subject && (
                            <div className="text-xs font-medium text-muted-foreground">
                              Re: {comm.subject}
                            </div>
                          )}

                          {/* Message body */}
                          <div className={cn(
                            "rounded-lg px-4 py-2.5",
                            isOutbound 
                              ? "bg-primary text-primary-foreground rounded-br-sm" 
                              : "bg-muted rounded-bl-sm"
                          )}>
                            <p className="text-sm whitespace-pre-wrap">{comm.message_body}</p>
                          </div>

                          {/* Footer - time & status */}
                          <div className={cn(
                            "flex items-center gap-2 text-[10px] text-muted-foreground",
                            isOutbound ? "flex-row-reverse" : "flex-row"
                          )}>
                            <span>{formatMessageDate(comm.occurred_at)}</span>
                            {isOutbound && (
                              <span className="flex items-center">
                                {comm.status === 'read' ? (
                                  <CheckCheck className="h-3 w-3 text-blue-500" />
                                ) : comm.status === 'delivered' ? (
                                  <CheckCheck className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      {isEditable && (
        <div className="border-t p-4 flex-shrink-0 space-y-3">
          <div className="flex items-center gap-2">
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(channelConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <config.icon className={cn("h-4 w-4", config.color)} />
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline">Outbound to {entityName}</Badge>
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              className="min-h-[80px] resize-none flex-1"
              disabled={sendCommunication.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sendCommunication.isPending}
              className="self-end"
            >
              {sendCommunication.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Press ⌘+Enter to send
          </p>
        </div>
      )}
    </Card>
  );
}
