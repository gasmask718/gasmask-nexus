import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, Send, Clock, CheckCircle, XCircle, Loader2, RefreshCw, MessageSquare, AlertTriangle } from 'lucide-react';

interface Followup {
  id: string;
  lead_id: string;
  demo_id: string | null;
  proposal_id: string | null;
  sequence_step: number;
  scheduled_at: string;
  sent_at: string | null;
  channel: string;
  message_template: string | null;
  status: string;
  created_at: string;
}

export default function FollowUpEnginePage() {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    let query = (supabase as any).from('brandaro_followups').select('*').order('scheduled_at', { ascending: true });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setFollowups(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filter]);

  const sendNow = async (fu: Followup) => {
    // Resolve lead phone for dispatch
    setSendingIds(prev => new Set(prev).add(fu.id));
    try {
      // Get lead phone number
      let phone = '';
      if (fu.lead_id) {
        const { data: lead } = await (supabase as any)
          .from('brandaro_qualified_leads')
          .select('phone_number, business_name')
          .eq('id', fu.lead_id)
          .single();
        phone = lead?.phone_number || '';
      }

      if (!phone) {
        toast.error('Cannot send: lead has no phone number');
        setSendingIds(prev => { const s = new Set(prev); s.delete(fu.id); return s; });
        return;
      }

      const message = fu.message_template || `Hi! Following up on our conversation. Would love to connect — let me know a good time!`;

      if (fu.channel === 'sms' || fu.channel === 'text' || !fu.channel) {
        // Invoke real Twilio SMS via brandaro-closer-action
        const { data, error } = await supabase.functions.invoke('brandaro-closer-action', {
          body: {
            action: 'sms',
            phone,
            message,
            lead_id: fu.lead_id,
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || 'SMS dispatch failed');
        }
      }

      // Only mark as sent AFTER successful dispatch
      await (supabase as any).from('brandaro_followups')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', fu.id);

      toast.success('Follow-up sent via SMS ✅');
      fetchData();
    } catch (err: any) {
      toast.error(`Send failed: ${err.message}`);
    } finally {
      setSendingIds(prev => { const s = new Set(prev); s.delete(fu.id); return s; });
    }
  };

  const cancelFollowup = async (id: string) => {
    await (supabase as any).from('brandaro_followups').update({ status: 'cancelled' }).eq('id', id);
    toast.success('Cancelled');
    fetch();
  };

  const overdue = followups.filter(f => f.status === 'pending' && new Date(f.scheduled_at) < new Date());
  const upcoming = followups.filter(f => f.status === 'pending' && new Date(f.scheduled_at) >= new Date());

  const stats = {
    pending: followups.filter(f => f.status === 'pending').length,
    sent: followups.filter(f => f.status === 'sent').length,
    overdue: overdue.length,
    converted: followups.filter(f => f.status === 'converted').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Follow-Up Automation</h1>
        <p className="text-muted-foreground">Automated reminder sequences for demo and proposal delivery</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-500' },
          { label: 'Overdue', value: stats.overdue, icon: Bell, color: 'text-destructive' },
          { label: 'Sent', value: stats.sent, icon: Send, color: 'text-primary' },
          { label: 'Converted', value: stats.converted, icon: CheckCircle, color: 'text-green-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue Alert */}
      {overdue.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-destructive" />
                <span className="font-semibold text-destructive">{overdue.length} overdue follow-ups need attention</span>
              </div>
              <Button size="sm" variant="destructive" onClick={() => overdue.forEach(f => sendNow(f))}>
                Send All Overdue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Follow-up Queue</CardTitle>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetch}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : followups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No follow-ups scheduled</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {followups.map(fu => {
                  const isOverdue = fu.status === 'pending' && new Date(fu.scheduled_at) < new Date();
                  return (
                    <TableRow key={fu.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                      <TableCell>Step {fu.sequence_step}</TableCell>
                      <TableCell><Badge variant="outline">{fu.channel}</Badge></TableCell>
                      <TableCell className={isOverdue ? 'text-destructive font-medium' : ''}>
                        {new Date(fu.scheduled_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                        {fu.message_template || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          fu.status === 'sent' ? 'default' :
                          fu.status === 'converted' ? 'default' :
                          fu.status === 'cancelled' ? 'destructive' : 'secondary'
                        }>
                          {fu.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {fu.status === 'pending' && (
                          <>
                            <Button size="sm" onClick={() => sendNow(fu)}><Send className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => cancelFollowup(fu.id)}><XCircle className="h-3 w-3" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
