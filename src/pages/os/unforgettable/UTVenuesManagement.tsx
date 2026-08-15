import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building, Search, Star as StarIcon, Loader2, ChevronDown, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { errText } from "@/lib/errText";

const sendApprovalSms = async (phone: string, message: string) => {
  try {
    await supabase.functions.invoke('send-approval-sms', { body: { to: phone, message } });
  } catch (err) {
    console.error('SMS notification failed (non-blocking):', errText(err));
  }
};

const StatusPill = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; label: string }> = {
    pending: { bg: 'bg-amber-500/20 text-amber-300 border border-amber-500/40', label: '⏳ Pending Review' },
    verified: { bg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40', label: '✅ Approved' },
    featured: { bg: 'bg-violet-500/20 text-violet-300 border border-violet-500/40', label: '⭐ Featured' },
    suspended: { bg: 'bg-red-500/20 text-red-300 border border-red-500/40', label: '🚫 Suspended' },
  };
  const c = config[status] || config.pending;
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${c.bg}`}>{c.label}</span>;
};

const formatApprovedDate = (status: string, updatedAt: string | null) => {
  if (status !== 'verified' && status !== 'featured') return '—';
  if (!updatedAt) return '—';
  try { return format(new Date(updatedAt), 'MMM d, yyyy h:mm a'); } catch { return '—'; }
};

export default function UTVenuesManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  

  const { data: halls = [] } = useQuery({
    queryKey: ['admin-halls'],
    queryFn: async () => {
      const { data } = await supabase.from('event_halls').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });


  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('venues-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_halls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-halls'] });
        toast.info('🔔 New venue application received!');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const updateHall = useMutation({
    mutationFn: async ({ id, updates, contactPhone }: { id: string; updates: Record<string, any>; contactPhone?: string }) => {
      const { error } = await supabase.from('event_halls').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) {
        console.error('UPDATE FAILED event_halls:', errText(error));
        throw error;
      }
      console.log('UPDATE SUCCESS event_halls:', id, updates);
      if (updates.status === 'verified' && contactPhone) {
        sendApprovalSms(contactPhone, '🎉 Congratulations! Your venue has been approved on Unforgettable Times.');
      }
    },
    onMutate: async ({ id }) => {
      setLoadingId(id);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-halls'] });
      const name = halls.find(h => h.id === vars.id)?.name || 'Venue';
      const msgs: Record<string, string> = {
        verified: `✅ ${name} approved!`,
        featured: `⭐ ${name} marked as featured!`,
        suspended: `❌ ${name} suspended`,
      };
      toast.success(msgs[vars.updates.status] || 'Updated!');
    },
    onError: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-halls'] });
      toast.error('Update failed');
    },
    onSettled: () => setLoadingId(null),
  });

  const suspended = halls.filter((h: any) => h.status === 'suspended');
  const nonSuspended = halls.filter((h: any) => h.status !== 'suspended');

  const filtered = nonSuspended.filter((h: any) => {
    const matchSearch = !search || h.name?.toLowerCase().includes(search.toLowerCase()) || h.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || h.status === statusFilter;
    const matchState = stateFilter === 'all' || h.state === stateFilter;
    return matchSearch && matchStatus && matchState;
  });

  const states = [...new Set(halls.map((h: any) => h.state).filter(Boolean))].sort();
  const pendingCount = halls.filter((h: any) => h.status === 'pending').length;

  const renderActions = (h: any) => {
    const isBusy = loadingId === h.id;
    switch (h.status) {
      case 'pending':
        return (
          <div className="flex gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isBusy}
              onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'verified' }, contactPhone: h.contact_phone })}>
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} ✅ Approve
            </Button>
            <Button size="sm" variant="outline" className="text-red-400 border-red-500/40 hover:bg-red-500/10" disabled={isBusy}
              onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'suspended' } })}>🚫 Suspend</Button>
          </div>
        );
      case 'verified':
        return (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-violet-400 border-violet-500/40 hover:bg-violet-500/10" disabled={isBusy}
              onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'featured', is_featured: true } })}>
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} ⭐ Feature
            </Button>
            <Button size="sm" variant="outline" className="text-red-400 border-red-500/40 hover:bg-red-500/10" disabled={isBusy}
              onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'suspended' } })}>🚫 Suspend</Button>
          </div>
        );
      case 'featured':
        return (
          <Button size="sm" variant="outline" className="text-red-400 border-red-500/40 hover:bg-red-500/10" disabled={isBusy}
            onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'suspended' } })}>🚫 Suspend</Button>
        );
      case 'suspended':
        return (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isBusy}
            onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'verified' }, contactPhone: h.contact_phone })}>
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} ✅ Reinstate
          </Button>
        );
      default: return null;
    }
  };

  const renderRow = (h: any) => (
    <TableRow key={h.id} className="hover:bg-accent/30 transition-colors">
      <TableCell className="font-medium">{h.name}</TableCell>
      <TableCell>{h.city || '—'}</TableCell>
      <TableCell>{h.state || '—'}</TableCell>
      <TableCell><StatusPill status={h.status} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatApprovedDate(h.status, h.updated_at)}</TableCell>
      <TableCell><span className="flex items-center gap-1"><StarIcon className="h-3 w-3 text-amber-400" />{Number(h.rating_avg || 0).toFixed(1)}</span></TableCell>
      <TableCell>{renderActions(h)}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building className="h-6 w-6 text-pink-400" /> Venues Management</h1>
        <div className="flex gap-2 items-center">
          {pendingCount > 0 && <Badge variant="outline" className="border-amber-500 text-amber-400">{pendingCount} Pending</Badge>}
          {pendingCount > 0 && (
            <Button size="sm" onClick={() => {
              halls.filter((h: any) => h.status === 'pending').forEach((h: any) => updateHall.mutate({ id: h.id, updates: { status: 'verified' }, contactPhone: h.contact_phone }));
            }}>Approve All Pending</Button>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search venues..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="featured">Featured</SelectItem></SelectContent></Select>
        <Select value={stateFilter} onValueChange={setStateFilter}><SelectTrigger className="w-36"><SelectValue placeholder="State" /></SelectTrigger><SelectContent><SelectItem value="all">All States</SelectItem>{states.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>City</TableHead><TableHead>State</TableHead>
                <TableHead>Status</TableHead><TableHead>Approved On</TableHead><TableHead>Rating</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(renderRow)}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40 text-muted-foreground" />
                  <p className="font-medium text-muted-foreground">No pending applications</p>
                  <p className="text-sm text-muted-foreground">All caught up! ✅</p>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {suspended.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between border-l-4 border-l-red-500 text-red-400 hover:bg-red-500/10">
              <span>🚫 Suspended ({suspended.length})</span><ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-l-4 border-l-red-500">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>City</TableHead><TableHead>State</TableHead>
                      <TableHead>Status</TableHead><TableHead>Approved On</TableHead><TableHead>Rating</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{suspended.map(renderRow)}</TableBody>
                </Table>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
