import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, MessageSquare, Clock, CheckCircle, XCircle, RefreshCw, Bell } from 'lucide-react';
import { toast } from 'sonner';

const SOLAR_AMBER = '#E8A317';

export default function SolarFollowUps() {
  const queryClient = useQueryClient();

  const { data: followups = [], isLoading } = useQuery({
    queryKey: ['solar-followups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_followups')
        .select('*, solar_leads(first_name, last_name, phone, email)')
        .order('send_time', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['solar-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_notifications')
        .select('*, solar_leads(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const markSeen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('solar_notifications').update({ seen: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['solar-notifications'] }),
  });

  const pending = followups.filter((f: any) => f.status === 'pending');
  const sent = followups.filter((f: any) => f.status === 'sent');
  const failed = followups.filter((f: any) => f.status === 'failed');
  const unseenNotifs = notifications.filter((n: any) => !n.seen);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'sent': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'high_intent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'booking_needed': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'escalation': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: SOLAR_AMBER }}>📬 Follow-Up Engine</h1>
          <p className="text-sm text-muted-foreground">Automated lead nurture + notification center</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['solar-followups'] })}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold" style={{ color: SOLAR_AMBER }}>{pending.length}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-green-500">{sent.length}</p>
          <p className="text-xs text-muted-foreground">Sent</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-red-500">{failed.length}</p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-purple-500">{unseenNotifs.length}</p>
          <p className="text-xs text-muted-foreground">Unseen Alerts</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="followups">
        <TabsList>
          <TabsTrigger value="followups"><MessageSquare className="h-4 w-4 mr-1" /> Follow-Ups</TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-1" /> Notifications
            {unseenNotifs.length > 0 && (
              <Badge className="ml-1 h-5 px-1.5 text-[10px]" style={{ backgroundColor: SOLAR_AMBER }}>{unseenNotifs.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="followups" className="space-y-3">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : followups.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No follow-ups scheduled yet</CardContent></Card>
          ) : (
            followups.map((f: any) => (
              <Card key={f.id} className="border-border/50">
                <CardContent className="py-3 flex items-center gap-3">
                  {statusIcon(f.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {f.solar_leads?.first_name} {f.solar_leads?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{f.message}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {f.channel === 'sms' ? <MessageSquare className="h-3 w-3 mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                      {f.channel}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Attempt #{f.attempt_number} · {new Date(f.send_time).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-3">
          {notifications.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No notifications</CardContent></Card>
          ) : (
            notifications.map((n: any) => (
              <Card key={n.id} className={`border-border/50 ${!n.seen ? 'bg-accent/30' : ''}`}>
                <CardContent className="py-3 flex items-center gap-3">
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${typeColor(n.type)}`}>{n.type.replace(/_/g, ' ')}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {n.solar_leads?.first_name} {n.solar_leads?.last_name} · {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.seen && (
                    <Button variant="ghost" size="sm" onClick={() => markSeen.mutate(n.id)}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
