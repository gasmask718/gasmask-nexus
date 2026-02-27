import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  History, Phone, PhoneCall, PhoneOff, PhoneMissed, Clock,
  Search, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';

const PAGE_SIZE = 50;

export default function DialerCallHistoryPage() {
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['dialer-history', bizId, page, statusFilter, search],
    queryFn: async () => {
      let q = supabase
        .from('outbound_call_queue')
        .select('*', { count: 'exact' })
        .eq('business_id', bizId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (search) q = q.or(`contact_name.ilike.%${search}%,phone_number.ilike.%${search}%`);

      const { data, count, error } = await q;
      if (error) throw error;
      return { items: data || [], total: count || 0 };
    },
    enabled: !!bizId,
  });

  const items = data?.items || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <PhoneCall className="h-3.5 w-3.5 text-green-600" />;
      case 'failed': return <PhoneOff className="h-3.5 w-3.5 text-destructive" />;
      case 'no_answer': return <PhoneMissed className="h-3.5 w-3.5 text-amber-600" />;
      default: return <Phone className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      completed: 'bg-green-500/10 text-green-600 border-green-500/30',
      failed: 'bg-destructive/10 text-destructive border-destructive/30',
      no_answer: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
      queued: 'bg-muted text-muted-foreground',
      dialing: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    };
    return map[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="w-full min-h-full space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><History className="h-6 w-6" /> Call History</h2>
        <p className="text-sm text-muted-foreground">{totalCount.toLocaleString()} total records</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap p-3 border rounded-lg bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="no_answer">No Answer</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="dialing">Dialing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            <div className="divide-y">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No call history</div>
              ) : items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                  {statusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{item.contact_name || 'Unknown'}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor(item.status)}`}>
                        {item.status}
                      </Badge>
                      {item.entity_type && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.entity_type}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {item.phone_number}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(item.created_at).toLocaleString()}</span>
                      {item.source_reason && <span>Source: {item.source_reason}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {totalCount > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm font-medium px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
