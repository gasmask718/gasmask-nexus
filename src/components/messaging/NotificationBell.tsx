import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUnreadCount, useThreads } from "@/services/messaging/useMessaging";
import { Bell, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

export function NotificationBell() {
  const { data: unreadCount } = useUnreadCount();
  const { data: threads } = useThreads();

  const recentThreads = threads?.slice(0, 5) || [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount && unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold">Messages</h4>
        </div>
        <ScrollArea className="h-64">
          {recentThreads.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No messages</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentThreads.map((thread) => (
                <Link
                  key={thread.id}
                  to={`/messages/${thread.id}`}
                  className="block p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                      💬
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {thread.subject || 'Conversation'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {thread.last_message}
                      </p>
                    </div>
                    {thread.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t">
          <Link to="/messages">
            <Button variant="ghost" className="w-full" size="sm">
              View All Messages
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
