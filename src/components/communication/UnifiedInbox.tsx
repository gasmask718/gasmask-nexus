import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, Phone, Bot, User, Send, Sparkles, 
  RefreshCw, Search, Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  channel: string;
  content: string | null;
  phone_number: string | null;
  status: string;
  ai_generated: boolean;
  created_at: string;
  store?: { id: string; store_name: string } | null;
  business?: { id: string; name: string; primary_color: string } | null;
}

interface UnifiedInboxProps {
  messages: Message[];
  selectedMessage: Message | null;
  onSelectMessage: (message: Message) => void;
  onSendReply: (content: string) => void;
  onSuggestReply: () => void;
  onRewriteTone: (content: string) => void;
  isSending: boolean;
  isSuggesting: boolean;
  suggestedReply: string;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function UnifiedInbox({
  messages,
  selectedMessage,
  onSelectMessage,
  onSendReply,
  onSuggestReply,
  onRewriteTone,
  isSending,
  isSuggesting,
  suggestedReply,
  searchTerm,
  onSearchChange,
}: UnifiedInboxProps) {
  const [replyContent, setReplyContent] = useState("");

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "sms":
      case "ai-sms":
        return <MessageSquare className="h-4 w-4" />;
      case "call":
      case "ai-call":
        return <Phone className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "sms": return "bg-blue-100 text-blue-800";
      case "ai-sms": return "bg-purple-100 text-purple-800";
      case "call": return "bg-green-100 text-green-800";
      case "ai-call": return "bg-indigo-100 text-indigo-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleSend = () => {
    if (replyContent.trim()) {
      onSendReply(replyContent);
      setReplyContent("");
    }
  };

  const filteredMessages = messages.filter(m => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.content?.toLowerCase().includes(term) ||
      m.store?.store_name?.toLowerCase().includes(term) ||
      m.business?.name?.toLowerCase().includes(term) ||
      m.phone_number?.includes(term)
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
      {/* Messages List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Inbox</CardTitle>
            <Badge variant="secondary">{messages.length}</Badge>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[480px]">
            {filteredMessages.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No messages found
              </div>
            ) : (
              <div className="divide-y">
                {filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    onClick={() => onSelectMessage(message)}
                    className={cn(
                      "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                      selectedMessage?.id === message.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                        style={{ backgroundColor: message.business?.primary_color || "#6366f1" }}
                      >
                        {message.business?.name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">
                            {message.store?.store_name || message.phone_number || "Unknown"}
                          </span>
                          {message.ai_generated && (
                            <Bot className="h-3 w-3 text-primary" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {message.content || "No content"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={cn("text-xs", getChannelColor(message.channel))}>
                            {getChannelIcon(message.channel)}
                            <span className="ml-1">{message.channel}</span>
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                      </div>
                      {message.direction === "inbound" && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Conversation View */}
      <Card className="lg:col-span-2">
        {selectedMessage ? (
          <>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: selectedMessage.business?.primary_color || "#6366f1" }}
                  >
                    {selectedMessage.business?.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {selectedMessage.store?.store_name || selectedMessage.phone_number}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedMessage.business?.name} • {selectedMessage.phone_number}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className={getChannelColor(selectedMessage.channel)}>
                  {selectedMessage.channel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col h-[calc(100%-140px)]">
              {/* Message Content */}
              <div className="flex-1 py-4">
                <div 
                  className={cn(
                    "max-w-[80%] p-4 rounded-lg",
                    selectedMessage.direction === "inbound"
                      ? "bg-muted"
                      : "bg-primary text-primary-foreground ml-auto"
                  )}
                >
                  <p className="text-sm">{selectedMessage.content}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                    {selectedMessage.ai_generated && <Bot className="h-3 w-3" />}
                    <span>{format(new Date(selectedMessage.created_at), "MMM d, h:mm a")}</span>
                  </div>
                </div>
              </div>

              {/* Reply Box */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onSuggestReply}
                    disabled={isSuggesting}
                  >
                    {isSuggesting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    AI Suggest
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => replyContent && onRewriteTone(replyContent)}
                    disabled={!replyContent}
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Brand Tone
                  </Button>
                </div>
                
                {suggestedReply && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm mb-2">{suggestedReply}</p>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => setReplyContent(suggestedReply)}
                    >
                      Use This
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button 
                    onClick={handleSend}
                    disabled={isSending || !replyContent.trim()}
                    className="self-end"
                  >
                    {isSending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select a message to view conversation</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
