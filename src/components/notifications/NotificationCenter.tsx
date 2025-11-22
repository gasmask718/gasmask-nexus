import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format, isToday, isPast, isFuture } from "date-fns";
import { useNavigate } from "react-router-dom";

export const NotificationCenter = () => {
  const navigate = useNavigate();

  const { data: reminders } = useQuery({
    queryKey: ['user-reminders'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('reminders')
        .select('*, stores(name), wholesale_hubs(name), influencers(name)')
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'overdue'])
        .order('follow_up_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const overdueReminders = reminders?.filter(r => 
    r.status === 'overdue' || 
    (r.status === 'pending' && isPast(new Date(r.follow_up_date)) && !isToday(new Date(r.follow_up_date)))
  ) || [];

  const todayReminders = reminders?.filter(r => 
    r.status === 'pending' && isToday(new Date(r.follow_up_date))
  ) || [];

  const upcomingReminders = reminders?.filter(r => 
    r.status === 'pending' && isFuture(new Date(r.follow_up_date)) && !isToday(new Date(r.follow_up_date))
  ) || [];

  const totalPending = (reminders?.length || 0);

  const getEntityName = (reminder: any) => {
    if (reminder.stores) return reminder.stores.name;
    if (reminder.wholesale_hubs) return reminder.wholesale_hubs.name;
    if (reminder.influencers) return reminder.influencers.name;
    return 'Unknown';
  };

  const handleReminderClick = (reminder: any) => {
    if (reminder.store_id) {
      navigate(`/stores/${reminder.store_id}`);
    } else if (reminder.wholesaler_id) {
      navigate(`/wholesale#${reminder.wholesaler_id}`);
    } else if (reminder.influencer_id) {
      navigate(`/influencers#${reminder.influencer_id}`);
    }
  };

  const ReminderSection = ({ title, items, variant }: { 
    title: string; 
    items: any[]; 
    variant: 'destructive' | 'default' | 'secondary' 
  }) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          <Badge variant={variant}>{items.length}</Badge>
        </div>
        <div className="space-y-2">
          {items.map(reminder => (
            <button
              key={reminder.id}
              onClick={() => handleReminderClick(reminder)}
              className="w-full text-left p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="font-medium text-sm">{getEntityName(reminder)}</div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(reminder.follow_up_date), 'MMM d, yyyy')}
              </div>
              {reminder.notes && (
                <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                  {reminder.notes}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalPending > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalPending}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Follow-Up Reminders</h3>
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-4">
            {totalPending === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No pending reminders
              </div>
            ) : (
              <>
                <ReminderSection 
                  title="Overdue" 
                  items={overdueReminders} 
                  variant="destructive" 
                />
                {overdueReminders.length > 0 && todayReminders.length > 0 && <Separator />}
                <ReminderSection 
                  title="Due Today" 
                  items={todayReminders} 
                  variant="default" 
                />
                {(overdueReminders.length > 0 || todayReminders.length > 0) && upcomingReminders.length > 0 && <Separator />}
                <ReminderSection 
                  title="Upcoming" 
                  items={upcomingReminders} 
                  variant="secondary" 
                />
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};