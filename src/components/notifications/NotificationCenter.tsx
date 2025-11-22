import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, AlertTriangle, MessageCircle, Target, BookOpen, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export const NotificationCenter = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch all notifications
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mark as read mutation
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
      case 'risk':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'communication':
        return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'mission':
        return <Target className="h-4 w-4 text-primary" />;
      case 'training':
        return <BookOpen className="h-4 w-4 text-primary" />;
      case 'report':
        return <TrendingUp className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead.mutate(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
    } else if (notification.entity_type === 'store' && notification.entity_id) {
      navigate(`/stores/${notification.entity_id}`);
    } else if (notification.entity_type === 'wholesale_hub' && notification.entity_id) {
      navigate(`/wholesale#${notification.entity_id}`);
    } else if (notification.entity_type === 'influencer' && notification.entity_id) {
      navigate(`/influencers#${notification.entity_id}`);
    }
  };

  const filterNotifications = (type?: string) => {
    if (!notifications) return [];
    if (!type || type === 'all') return notifications;
    return notifications.filter(n => n.type === type);
  };

  const NotificationItem = ({ notification }: { notification: any }) => (
    <button
      onClick={() => handleNotificationClick(notification)}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        notification.is_read ? 'bg-muted/50' : 'bg-accent hover:bg-accent/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-sm font-medium ${notification.is_read ? 'text-muted-foreground' : ''}`}>
              {notification.title}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(notification.created_at), 'MMM d, h:mm a')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
        </div>
      </div>
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <Tabs defaultValue="all" className="w-full">
          <div className="border-b px-4">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="alert" className="text-xs">Alerts</TabsTrigger>
              <TabsTrigger value="communication" className="text-xs">Comms</TabsTrigger>
              <TabsTrigger value="mission" className="text-xs">Missions</TabsTrigger>
              <TabsTrigger value="training" className="text-xs">Training</TabsTrigger>
            </TabsList>
          </div>
          
          <ScrollArea className="h-[500px]">
            {['all', 'alert', 'communication', 'mission', 'training'].map(tab => (
              <TabsContent key={tab} value={tab} className="m-0 p-4 space-y-2">
                {filterNotifications(tab).length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12">
                    No {tab !== 'all' ? tab : ''} notifications
                  </div>
                ) : (
                  filterNotifications(tab).map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};