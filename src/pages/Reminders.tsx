import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, AlertCircle, Store, Building2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function Reminders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders, isLoading } = useQuery({
    queryKey: ['all-reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select(`
          *,
          stores(name),
          wholesale_hubs:wholesaler_id(name),
          influencers(name),
          assigned_to_profile:assigned_to(name)
        `)
        .order('follow_up_date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const completeReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-reminders'] });
      toast({ title: "Reminder completed" });
    },
  });

  const getEntityIcon = (reminder: any) => {
    if (reminder.store_id) return <Store className="h-4 w-4" />;
    if (reminder.wholesaler_id) return <Building2 className="h-4 w-4" />;
    if (reminder.influencer_id) return <MessageCircle className="h-4 w-4" />;
    return null;
  };

  const getEntityName = (reminder: any) => {
    if (reminder.stores) return reminder.stores.name;
    if (reminder.wholesale_hubs) return reminder.wholesale_hubs.name;
    if (reminder.influencers) return reminder.influencers.name;
    return 'Unknown';
  };

  const getEntityLink = (reminder: any) => {
    if (reminder.store_id) return `/stores/${reminder.store_id}`;
    if (reminder.wholesaler_id) return `/wholesale/${reminder.wholesaler_id}`;
    if (reminder.influencer_id) return `/influencers/${reminder.influencer_id}`;
    return '#';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const pendingReminders = reminders?.filter(r => r.status !== 'completed') || [];
  const completedReminders = reminders?.filter(r => r.status === 'completed') || [];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-muted-foreground">Loading reminders...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reminders Center</h1>
          <p className="text-muted-foreground">
            Manage all follow-up reminders across stores, wholesalers, and influencers
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold">{pendingReminders.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-3xl font-bold">
                  {pendingReminders.filter(r => r.status === 'overdue').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold">{completedReminders.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </Card>
        </div>

        {/* Pending Reminders */}
        <div>
          <h2 className="text-xl font-bold mb-4">Pending Reminders</h2>
          <div className="space-y-3">
            {pendingReminders.map((reminder) => (
              <Card key={reminder.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getEntityIcon(reminder)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <a 
                          href={getEntityLink(reminder)}
                          className="font-semibold hover:text-primary"
                        >
                          {getEntityName(reminder)}
                        </a>
                        {getStatusBadge(reminder.status)}
                      </div>
                      {reminder.notes && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {reminder.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Due: {new Date(reminder.follow_up_date).toLocaleDateString()}
                        </div>
                        {reminder.assigned_to_profile && (
                          <div>
                            Assigned to: {reminder.assigned_to_profile.name}
                          </div>
                        )}
                        <div>
                          Created {formatDistanceToNow(new Date(reminder.created_at))} ago
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => completeReminder.mutate(reminder.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                </div>
              </Card>
            ))}

            {pendingReminders.length === 0 && (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground">
                  No pending reminders at the moment
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Recently Completed */}
        {completedReminders.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Recently Completed</h2>
            <div className="space-y-3">
              {completedReminders.slice(0, 10).map((reminder) => (
                <Card key={reminder.id} className="p-4 opacity-60">
                  <div className="flex items-start gap-3">
                    {getEntityIcon(reminder)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{getEntityName(reminder)}</span>
                        {getStatusBadge(reminder.status)}
                      </div>
                      {reminder.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {reminder.notes}
                        </p>
                      )}
                      <div className="text-sm text-muted-foreground">
                        Completed {formatDistanceToNow(new Date(reminder.completed_at))} ago
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
