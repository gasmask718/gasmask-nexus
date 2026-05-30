import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Inbox, Users, Eye } from 'lucide-react';
import { format } from 'date-fns';

export default function OpsInboxAdmin() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('message');
  const [priority, setPriority] = useState('normal');
  const [targetRole, setTargetRole] = useState('');
  const [sending, setSending] = useState(false);

  // Fetch recent threads for admin view
  const { data: recentThreads = [], refetch } = useQuery({
    queryKey: ['admin-ops-inbox-threads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ops_inbox_threads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Get delivery stats
  const { data: stats } = useQuery({
    queryKey: ['admin-ops-inbox-stats'],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('ops_inbox_recipients')
        .select('id', { count: 'exact', head: true });

      const { count: read } = await supabase
        .from('ops_inbox_recipients')
        .select('id', { count: 'exact', head: true })
        .not('read_at', 'is', null);

      const { count: acked } = await supabase
        .from('ops_inbox_recipients')
        .select('id', { count: 'exact', head: true })
        .not('acknowledged_at', 'is', null);

      return { total: total || 0, read: read || 0, acked: acked || 0 };
    },
  });

  const handleSend = async () => {
    if (!title.trim() || !body.trim() || !targetRole) {
      toast.error('Fill all required fields');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-ops-thread', {
        body: {
          type,
          title: title.trim(),
          message_body: body.trim(),
          priority,
          targeting: { roles: [targetRole] },
        },
      });

      if (error) throw error;
      toast.success(`Thread created — ${data.recipients} recipients`);
      setTitle('');
      setBody('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create thread');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Ops Inbox Admin</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total Deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats?.read || 0}</p>
            <p className="text-xs text-muted-foreground">Read</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats?.acked || 0}</p>
            <p className="text-xs text-muted-foreground">Acknowledged</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Thread */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Broadcast Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Message</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                  <SelectItem value="campaign">Campaign</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Target Role</Label>
            <Select value={targetRole} onValueChange={setTargetRole}>
              <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="driver">Drivers</SelectItem>
                <SelectItem value="biker">Bikers</SelectItem>
                <SelectItem value="ambassador">Ambassadors</SelectItem>
                <SelectItem value="influencer">Influencers</SelectItem>
                <SelectItem value="store">Stores</SelectItem>
                <SelectItem value="wholesaler">Wholesalers</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Thread title..." />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Message body..." rows={4} />
          </div>

          <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
            <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send Broadcast'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Threads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Inbox className="h-4 w-4" /> Recent Threads</CardTitle>
        </CardHeader>
        <CardContent>
          {recentThreads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No threads yet</p>
          ) : (
            <div className="space-y-2">
              {recentThreads.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{t.priority}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(t.created_at), 'MMM d, yyyy, h:mm a')}
                      </span>
                    </div>
                  </div>
                  <Badge variant={t.status === 'open' ? 'default' : 'secondary'}>{t.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
