import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useMessages, useSendMessage, useThread, Message } from "@/services/messaging/useMessaging";
import { useAuth } from "@/contexts/AuthContext";
import { MessageBubble } from "./MessageBubble";
import { 
  Send, 
  Paperclip, 
  Smile, 
  Sparkles, 
  ArrowLeft,
  MoreVertical,
  Phone,
  Video
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatWindowProps {
  threadId: string;
  onBack?: () => void;
}

export function ChatWindow({ threadId, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const { data: thread } = useThread(threadId);
  const { data: messages, isLoading } = useMessages(threadId);
  const sendMessage = useSendMessage();
  
  const [newMessage, setNewMessage] = useState("");
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const otherParticipant = thread?.participants.find(p => p.user_id !== user?.id);

    await sendMessage.mutateAsync({
      threadId,
      messageText: newMessage,
      receiverId: otherParticipant?.user_id,
      receiverRole: otherParticipant?.role,
    });

    setNewMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const otherParticipant = thread?.participants.find(p => p.user_id !== user?.id);

  // Group messages by date
  const groupedMessages = messages?.reduce((groups, message) => {
    const date = format(new Date(message.created_at), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>) || {};

  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <CardHeader className="border-b py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              {otherParticipant?.name?.charAt(0) || otherParticipant?.role?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <CardTitle className="text-base">
                {otherParticipant?.name || thread?.subject || 'Conversation'}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {otherParticipant?.role || thread?.thread_type}
                </Badge>
                <span className="text-xs text-green-500">● Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Video className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>View Profile</DropdownMenuItem>
                <DropdownMenuItem>Search Messages</DropdownMenuItem>
                <DropdownMenuItem>Mute Notifications</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Block User</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading messages...</div>
        ) : Object.keys(groupedMessages).length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {format(new Date(date), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="space-y-3">
                  {msgs.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.sender_id === user?.id}
                      showTranslation={showTranslations[message.id]}
                      onToggleTranslation={() => setShowTranslations(prev => ({
                        ...prev,
                        [message.id]: !prev[message.id]
                      }))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <CardContent className="border-t p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Smile className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button variant="ghost" size="icon">
            <Sparkles className="h-5 w-5 text-primary" />
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!newMessage.trim() || sendMessage.isPending}
            size="icon"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
