import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, Clock, Phone, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CRMFollowUps = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: followUps, isLoading } = useQuery({
    queryKey: ['all-follow-ups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_logs')
        .select(`
          *,
          contact:crm_contacts(id, name, type),
          store:stores(id, name),
          created_by_profile:profiles!communication_logs_created_by_fkey(name)
        `)
        .eq('follow_up_required', true)
        .order('follow_up_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

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

  if (isLoading) {
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
              <p className="text-2xl font-bold">{followUps?.length || 0}</p>
            </div>
            <Calendar className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold text-blue-500">
                {upcomingFollowUps?.length || 0}
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
                {overdueFollowUps?.length || 0}
              </p>
            </div>
            <Clock className="h-8 w-8 text-destructive" />
          </div>
        </Card>
      </div>

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
                        {followUp.contact?.name || followUp.store?.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {followUp.summary}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs text-destructive">
                          <Calendar className="h-3 w-3" />
                          Due: {new Date(followUp.follow_up_date!).toLocaleDateString()}
                        </div>
                        <Badge variant="outline" className="capitalize text-xs">
                          {followUp.channel}
                        </Badge>
                        {followUp.contact?.type && (
                          <Badge variant="outline" className="capitalize text-xs">
                            {followUp.contact.type}
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
                      {followUp.contact?.name || followUp.store?.name || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {followUp.summary}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Due: {new Date(followUp.follow_up_date!).toLocaleDateString()}
                      </div>
                      <Badge variant="outline" className="capitalize text-xs">
                        {followUp.channel}
                      </Badge>
                      {followUp.contact?.type && (
                        <Badge variant="outline" className="capitalize text-xs">
                          {followUp.contact.type}
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
    </div>
  );
};

export default CRMFollowUps;