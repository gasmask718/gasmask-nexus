import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useThreads, MessageThread } from "@/services/messaging/useMessaging";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Search, 
  MessageSquare, 
  Bell, 
  Users, 
  Plus,
  Filter
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface MessagingInboxProps {
  onSelectThread: (threadId: string) => void;
  selectedThreadId?: string;
  threadTypeFilter?: string;
}

export function MessagingInbox({ 
  onSelectThread, 
  selectedThreadId,
  threadTypeFilter 
}: MessagingInboxProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  const { data: threads, isLoading } = useThreads({ 
    type: threadTypeFilter 
  });

  const filteredThreads = threads?.filter(thread => {
    const matchesSearch = !search || 
      thread.subject?.toLowerCase().includes(search.toLowerCase()) ||
      thread.last_message?.toLowerCase().includes(search.toLowerCase());
    
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'unread' && thread.unread_count && thread.unread_count > 0) ||
      (activeTab === 'system' && thread.thread_type === 'system_ai_alerts');
    
    return matchesSearch && matchesTab;
  }) || [];

  const getThreadIcon = (type: string) => {
    switch (type) {
      case 'store_wholesaler': return '🏪';
      case 'customer_support': return '💬';
      case 'driver_dispatch': return '🚗';
      case 'biker_dispatch': return '🚴';
      case 'ambassador_support': return '⭐';
      case 'production_hq': return '🏭';
      case 'system_ai_alerts': return '🤖';
      default: return '💬';
    }
  };

  const getOtherParticipant = (thread: MessageThread) => {
    return thread.participants.find(p => p.user_id !== user?.id);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b py-3 px-4">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 grid grid-cols-3">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="unread" className="text-xs">
            Unread
          </TabsTrigger>
          <TabsTrigger value="system" className="text-xs">
            <Bell className="h-3 w-3 mr-1" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 mt-2">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Loading conversations...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredThreads.map((thread) => {
                  const other = getOtherParticipant(thread);
                  const isSelected = thread.id === selectedThreadId;

                  return (
                    <button
                      key={thread.id}
                      onClick={() => onSelectThread(thread.id)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-accent/50 transition-colors",
                        isSelected && "bg-accent"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl flex-shrink-0">
                          {getThreadIcon(thread.thread_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate">
                                {thread.subject || other?.name || other?.role || 'Conversation'}
                              </span>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {other?.role || thread.thread_type}
                              </Badge>
                            </div>
                            {thread.last_message_at && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: false })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {thread.last_message || 'No messages yet'}
                          </p>
                        </div>
                        {thread.unread_count && thread.unread_count > 0 && (
                          <Badge className="flex-shrink-0">
                            {thread.unread_count}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
