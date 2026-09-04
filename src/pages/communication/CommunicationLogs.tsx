import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { FileText, Phone, MessageSquare, Mail, Search, MailOpen, PhoneMissed, CheckCircle2, ExternalLink } from 'lucide-react';
import CommunicationLayout from './CommunicationLayout';
import {
  CALL_CHANNELS,
  isMissedCall,
  isUnreadMessage,
  isUnresolvedCall,
  useMarkCallHandled,
  useMarkRead,
} from '@/hooks/useCommsAwareness';

/**
 * Unified communication log — ONE canonical source: public.communication_logs.
 * Surfaces unread inbound messages and missed/unhandled calls so nothing is
 * silently lost. Read/handled state is never set by simply viewing this page.
 */
const CommunicationLogs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const markRead = useMarkRead();
  const markHandled = useMarkCallHandled();

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ['communication-canonical-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('communication_logs')
        .select(
          'id, created_at, channel, direction, status, outcome, summary, message_content, sender_phone, recipient_phone, store_id, contact_id, performed_by, created_by, duration_seconds, call_duration, answered_at, read_at, read_by, handled_at, handled_by, delivery_status, brand',
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const storeIds = useMemo(
    () => Array.from(new Set(logs.map((l: any) => l.store_id).filter(Boolean))) as string[],
    [logs],
  );

  const { data: storeNames } = useQuery({
    queryKey: ['comm-log-store-names', storeIds.sort().join(',')],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_master')
        .select('id, store_name, address')
        .in('id', storeIds);
      if (error) throw error;
      const map: Record<string, { name: string; address: string | null }> = {};
      (data || []).forEach((s: any) => { map[s.id] = { name: s.store_name, address: s.address }; });
      return map;
    },
  });

  const counts = useMemo(() => ({
    unread: logs.filter(isUnreadMessage).length,
    unresolved: logs.filter(isUnresolvedCall).length,
  }), [logs]);

  const filtered = useMemo(() => {
    let rows = logs;
    if (channelFilter === 'call') rows = rows.filter((l: any) => CALL_CHANNELS.includes(l.channel));
    else if (channelFilter !== 'all') rows = rows.filter((l: any) => l.channel === channelFilter);

    if (statusFilter === 'unread') rows = rows.filter(isUnreadMessage);
    else if (statusFilter === 'missed') rows = rows.filter(isUnresolvedCall);
    else if (statusFilter === 'inbound') rows = rows.filter((l: any) => l.direction === 'inbound');

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((l: any) =>
        [l.summary, l.message_content, l.sender_phone, l.recipient_phone, l.performed_by,
          l.store_id ? storeNames?.[l.store_id]?.name : null]
          .filter(Boolean)
          .some((v: any) => String(v).toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [logs, channelFilter, statusFilter, searchTerm, storeNames]);

  const getIcon = (channel: string) => {
    if (CALL_CHANNELS.includes(channel)) return <Phone className="h-4 w-4" />;
    if (channel === 'email') return <Mail className="h-4 w-4" />;
    if (channel === 'sms') return <MessageSquare className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const unreadIds = useMemo(() => filtered.filter(isUnreadMessage).map((l: any) => l.id), [filtered]);

  return (
    <CommunicationLayout
      title="Unified Communication Logs"
      subtitle="Every call, text and email on one canonical timeline"
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className={counts.unread ? 'border-primary/50' : undefined}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <MailOpen className="h-4 w-4 text-primary" />
                <span className="text-sm">Unread inbound messages</span>
              </div>
              <Badge variant={counts.unread ? 'default' : 'secondary'}>{counts.unread}</Badge>
            </CardContent>
          </Card>
          <Card className={counts.unresolved ? 'border-destructive/50' : undefined}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <PhoneMissed className="h-4 w-4 text-destructive" />
                <span className="text-sm">Missed calls not yet handled</span>
              </div>
              <Badge variant={counts.unresolved ? 'destructive' : 'secondary'}>{counts.unresolved}</Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages, numbers, stores..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="call">Calls Only</SelectItem>
                <SelectItem value="sms">Texts Only</SelectItem>
                <SelectItem value="email">Email Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread only</SelectItem>
                <SelectItem value="missed">Missed / unhandled calls</SelectItem>
                <SelectItem value="inbound">Inbound only</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Communication Timeline
              <Badge variant="outline">{filtered.length}</Badge>
            </CardTitle>
            {unreadIds.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={markRead.isPending}
                onClick={() => markRead.mutate(unreadIds)}
              >
                Mark {unreadIds.length} read
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading logs...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{(error as Error).message}</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No communication logs found</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((log: any) => {
                  const unread = isUnreadMessage(log);
                  const unresolved = isUnresolvedCall(log);
                  const store = log.store_id ? storeNames?.[log.store_id] : null;
                  return (
                    <div
                      key={log.id}
                      className={`rounded-lg border p-4 ${
                        unread ? 'border-primary/60 bg-primary/5'
                          : unresolved ? 'border-destructive/50 bg-destructive/5'
                          : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {getIcon(log.channel)}
                        <Badge variant="outline" className="capitalize">{log.channel}</Badge>
                        <Badge variant={log.direction === 'inbound' ? 'default' : 'secondary'} className="capitalize">
                          {log.direction}
                        </Badge>
                        {unread && <Badge className="bg-primary text-primary-foreground">Unread</Badge>}
                        {CALL_CHANNELS.includes(log.channel) && (
                          isMissedCall(log)
                            ? <Badge variant="destructive">Missed / unanswered</Badge>
                            : <Badge variant="secondary">Answered</Badge>
                        )}
                        {log.handled_at && (
                          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-600/40">
                            <CheckCircle2 className="h-3 w-3" /> Handled
                          </Badge>
                        )}
                        <time className="ml-auto text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </time>
                      </div>

                      <p className="mt-2 text-sm font-medium">
                        {log.direction === 'inbound'
                          ? `${log.sender_phone || 'Unknown'} → us`
                          : `us → ${log.recipient_phone || 'Unknown'}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {log.message_content || log.summary || '—'}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {log.performed_by && <span>By {log.performed_by}</span>}
                        {store ? (
                          <Link
                            to={`/stores/${log.store_id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> {store.name}
                          </Link>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">No account linked</Badge>
                        )}
                        {unread && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px]"
                            disabled={markRead.isPending}
                            onClick={() => markRead.mutate([log.id])}
                          >
                            Mark read
                          </Button>
                        )}
                        {unresolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px]"
                            disabled={markHandled.isPending}
                            onClick={() => markHandled.mutate({ id: log.id })}
                          >
                            Mark handled
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationLogs;
