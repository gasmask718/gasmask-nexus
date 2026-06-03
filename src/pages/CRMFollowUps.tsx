import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarIcon, CheckCircle2, Clock, Phone, Mail, MessageSquare, List, Building2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isPast, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { FollowUpFilterView, FollowUpCalendarView, StoreFollowUp, CalendarFollowUp } from '@/components/followups';
import { useAllActiveFollowUps } from '@/hooks/useFollowUps';

const CRMFollowUps = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('list');

  // Existing communication_logs follow-ups
  const { data: followUps, isLoading } = useQuery({
    queryKey: ['all-follow-ups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_logs')
        .select(`
          *,
          store:stores(id, name),
          created_by_profile:profiles!communication_logs_created_by_fkey(name)
        `)
        .eq('follow_up_required', true)
        .order('follow_up_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Follow-up queue data for stores/calendar views
  const { data: queueFollowUps, isLoading: isQueueLoading } = useAllActiveFollowUps();

  const completeFollowUpMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('communication_logs')
        .update({ follow_up_required: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Follow-up marked as complete');
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
    },
    onError: (error) => {
      toast.error('Failed to complete follow-up: ' + error.message);
    },
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const isOverdue = (date: string) => {
    return new Date(date) < new Date();
  };

  const upcomingFollowUps = followUps?.filter(
    (f) => f.follow_up_date && !isOverdue(f.follow_up_date)
  );
  const overdueFollowUps = followUps?.filter(
    (f) => f.follow_up_date && isOverdue(f.follow_up_date)
  );

  // Transform queue follow-ups for filter view
  const storeFollowUps: StoreFollowUp[] = useMemo(() => {
    if (!queueFollowUps) return [];
    return queueFollowUps
      .filter(fu => fu.store_id && fu.store)
      .map(fu => {
        const dueDate = new Date(fu.due_at);
        let status: StoreFollowUp['status'] = 'upcoming';
        if (isToday(dueDate)) {
          status = 'pending';
        } else if (isPast(dueDate)) {
          status = 'overdue';
        }
        return {
          id: fu.id,
          storeId: fu.store_id!,
          storeName: fu.store?.name || 'Unknown Store',
          storeAddress: fu.store?.address,
          dueAt: dueDate,
          reason: fu.reason,
          actionType: fu.recommended_action || 'follow-up',
          status,
        };
      });
  }, [queueFollowUps]);

  // Transform queue follow-ups for calendar view
  const calendarFollowUps: CalendarFollowUp[] = useMemo(() => {
    if (!queueFollowUps) return [];
    return queueFollowUps
      .filter(fu => fu.store_id && fu.store)
      .map(fu => ({
        id: fu.id,
        storeId: fu.store_id!,
        storeName: fu.store?.name || 'Unknown Store',
        storeAddress: fu.store?.address,
        dueAt: new Date(fu.due_at),
        reason: fu.reason,
        actionType: fu.recommended_action || 'follow-up',
      }));
  }, [queueFollowUps]);

  if (isLoading && isQueueLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Follow-ups</h1>
        <p className="text-muted-foreground mt-1">
          Track and manage all scheduled follow-up communications
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Follow-ups</p>
              <p className="text-2xl font-bold">{(followUps?.length || 0) + (storeFollowUps.length)}</p>
            </div>
            <CalendarIcon className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold text-blue-500">
                {(upcomingFollowUps?.length || 0) + storeFollowUps.filter(f => f.status === 'upcoming').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-destructive">
                {(overdueFollowUps?.length || 0) + storeFollowUps.filter(f => f.status === 'overdue').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-destructive" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-12 w-full grid grid-cols-3">
          <TabsTrigger value="list" className="text-base gap-2 h-10">
            <List className="h-5 w-5" />
            List
          </TabsTrigger>
          <TabsTrigger value="stores" className="text-base gap-2 h-10">
            <Building2 className="h-5 w-5" />
            Stores
          </TabsTrigger>
          <TabsTrigger value="calendar" className="text-base gap-2 h-10">
            <CalendarDays className="h-5 w-5" />
            Calendar
          </TabsTrigger>
        </TabsList>

        {/* List Tab - Original View */}
        <TabsContent value="list" className="space-y-4">
          {/* Overdue Follow-ups */}
          {overdueFollowUps && overdueFollowUps.length > 0 && (
            <Card className="p-6 border-destructive/20">
              <h2 className="text-lg font-semibold mb-4 text-destructive">
                Overdue Follow-ups
              </h2>
              <div className="space-y-3">
                {overdueFollowUps.map((followUp) => (
                  <div
                    key={followUp.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-destructive/20 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors"
                    onClick={() => {
                      if (followUp.contact_id) {
                        navigate(`/crm/contacts/${followUp.contact_id}`);
                      } else if (followUp.store_id) {
                        navigate(`/stores/${followUp.store_id}`);
                      }
                    }}
                  >
                    <div className="p-2 rounded-lg bg-destructive/10">
                      {getChannelIcon(followUp.channel)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium hover:underline">
                            {(followUp as any).contact?.name || followUp.store?.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {followUp.summary}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1 text-xs text-destructive">
                              <CalendarIcon className="h-3 w-3" />
                              Due: {new Date(followUp.follow_up_date!).toLocaleDateString()}
                            </div>
                            <Badge variant="outline" className="capitalize text-xs">
                              {followUp.channel}
                            </Badge>
                            {(followUp as any).contact?.type && (
                              <Badge variant="outline" className="capitalize text-xs">
                                {(followUp as any).contact.type}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            completeFollowUpMutation.mutate(followUp.id);
                          }}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Upcoming Follow-ups */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Upcoming Follow-ups</h2>
            <div className="space-y-3">
              {upcomingFollowUps?.map((followUp) => (
                <div
                  key={followUp.id}
                  className="flex items-start gap-4 p-4 rounded-lg border hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (followUp.contact_id) {
                      navigate(`/crm/contacts/${followUp.contact_id}`);
                    } else if (followUp.store_id) {
                      navigate(`/stores/${followUp.store_id}`);
                    }
                  }}
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    {getChannelIcon(followUp.channel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium hover:underline">
                          {(followUp as any).contact?.name || followUp.store?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {followUp.summary}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarIcon className="h-3 w-3" />
                            Due: {new Date(followUp.follow_up_date!).toLocaleDateString()}
                          </div>
                          <Badge variant="outline" className="capitalize text-xs">
                            {followUp.channel}
                          </Badge>
                          {(followUp as any).contact?.type && (
                            <Badge variant="outline" className="capitalize text-xs">
                              {(followUp as any).contact.type}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          completeFollowUpMutation.mutate(followUp.id);
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Complete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {(!upcomingFollowUps || upcomingFollowUps.length === 0) && (
                <p className="text-center py-12 text-muted-foreground">
                  No upcoming follow-ups scheduled
                </p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Stores Tab - Filter View */}
        <TabsContent value="stores">
          <FollowUpFilterView 
            followUps={storeFollowUps} 
            isLoading={isQueueLoading}
          />
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <FollowUpCalendarView 
            followUps={calendarFollowUps}
            isLoading={isQueueLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CRMFollowUps;
