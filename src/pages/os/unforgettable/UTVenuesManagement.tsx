import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building, Search, CheckCircle, XCircle, Star as StarIcon, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const sendApprovalSms = async (phone: string, message: string) => {
  try {
    await supabase.functions.invoke('send-approval-sms', {
      body: { to: phone, message }
    });
  } catch (err) {
    console.error('SMS notification failed (non-blocking):', err);
  }
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'verified': return 'border-emerald-500 text-emerald-400';
    case 'featured': return 'border-violet-500 text-violet-400';
    case 'suspended': return 'border-red-500 text-red-400';
    default: return 'border-amber-500 text-amber-400';
  }
};

export default function UTVenuesManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());

  const { data: halls = [] } = useQuery({
    queryKey: ['admin-halls'],
    queryFn: async () => {
      const { data } = await supabase.from('event_halls').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const updateHall = useMutation({
    mutationFn: async ({ id, updates, contactPhone }: { id: string; updates: Record<string, any>; contactPhone?: string }) => {
      setMutatingIds(prev => new Set(prev).add(id));
      await supabase.from('event_halls').update(updates).eq('id', id);
      if (updates.status === 'verified' && contactPhone) {
        sendApprovalSms(contactPhone, '🎉 Congratulations! Your venue has been approved on Unforgettable Times. Log in to complete your profile and start receiving bookings!');
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-halls'] });
      setMutatingIds(prev => { const n = new Set(prev); n.delete(vars.id); return n; });
      const msg = vars.updates.status === 'verified' ? '✅ Approved successfully' : vars.updates.status === 'featured' ? '⭐ Marked as featured' : '❌ Suspended';
      toast.success(msg);
    },
    onError: (_e, vars) => {
      setMutatingIds(prev => { const n = new Set(prev); n.delete(vars.id); return n; });
      toast.error('Update failed');
    }
  });

  const filtered = halls.filter((h: any) => {
    const matchSearch = !search || h.name?.toLowerCase().includes(search.toLowerCase()) || h.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || h.status === statusFilter;
    const matchState = stateFilter === 'all' || h.state === stateFilter;
    return matchSearch && matchStatus && matchState;
  });

  const states = [...new Set(halls.map((h: any) => h.state).filter(Boolean))].sort();
  const pendingCount = halls.filter((h: any) => h.status === 'pending').length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building className="h-6 w-6 text-pink-400" /> Venues Management</h1>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-amber-500 text-amber-400">{pendingCount} Pending</Badge>
          <Button size="sm" onClick={() => {
            halls.filter((h: any) => h.status === 'pending').forEach((h: any) => updateHall.mutate({ id: h.id, updates: { status: 'verified' }, contactPhone: h.contact_phone }));
          }}>Approve All Pending</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search halls..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="featured">Featured</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select>
        <Select value={stateFilter} onValueChange={setStateFilter}><SelectTrigger className="w-36"><SelectValue placeholder="State" /></SelectTrigger><SelectContent><SelectItem value="all">All States</SelectItem>{states.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>City</TableHead><TableHead>State</TableHead>
                <TableHead>Status</TableHead><TableHead>Rating</TableHead><TableHead>Views</TableHead>
                <TableHead>Inquiries</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((h: any) => {
                const isBusy = mutatingIds.has(h.id);
                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>{h.city || '—'}</TableCell>
                    <TableCell>{h.state || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={statusBadgeClass(h.status)}>{h.status}</Badge></TableCell>
                    <TableCell><span className="flex items-center gap-1"><StarIcon className="h-3 w-3 text-amber-400" />{Number(h.rating_avg || 0).toFixed(1)}</span></TableCell>
                    <TableCell><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{h.views_count}</span></TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        {isBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {!isBusy && h.status === 'verified' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                        {!isBusy && h.status !== 'verified' && h.status !== 'featured' && (
                          <Button size="sm" variant="outline" className="text-emerald-400" disabled={isBusy} onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'verified' }, contactPhone: h.contact_phone })}><CheckCircle className="h-3 w-3" /></Button>
                        )}
                        {!isBusy && h.status !== 'featured' && (
                          <Button size="sm" variant="outline" className="text-pink-400" disabled={isBusy} onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'featured', is_featured: true } })}><StarIcon className="h-3 w-3" /></Button>
                        )}
                        {!isBusy && h.status !== 'suspended' && (
                          <Button size="sm" variant="outline" className="text-red-400" disabled={isBusy} onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'suspended' } })}><XCircle className="h-3 w-3" /></Button>
                        )}
                        {!isBusy && h.status === 'suspended' && (
                          <Button size="sm" variant="outline" className="text-emerald-400" disabled={isBusy} onClick={() => updateHall.mutate({ id: h.id, updates: { status: 'verified' }, contactPhone: h.contact_phone })}><CheckCircle className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No venues found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
