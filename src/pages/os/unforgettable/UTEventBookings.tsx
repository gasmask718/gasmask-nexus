import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, DollarSign, Users, CheckCircle2, Loader2, XCircle, ChevronDown, ChevronRight, Mail, Phone, Sparkles, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { errText } from "@/lib/errText";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending_payment: { label: '⏳ Pending Payment', classes: 'bg-amber-500/20 text-amber-300 border border-amber-500/40' },
  deposit_received: { label: '💰 Deposit Received', classes: 'bg-blue-500/20 text-blue-300 border border-blue-500/40' },
  confirmed: { label: '✅ Confirmed', classes: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' },
  in_progress: { label: '🎉 In Progress', classes: 'bg-violet-500/20 text-violet-300 border border-violet-500/40' },
  completed: { label: '🏁 Completed', classes: 'bg-muted text-muted-foreground border-border' },
  cancelled: { label: '❌ Cancelled', classes: 'bg-red-500/20 text-red-300 border border-red-500/40' },
};

export default function UTEventBookings() {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['ut-event-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ut_event_bookings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('ut-event-bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_event_bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ut-event-bookings'] });
        toast.info('🔔 Bookings updated!');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      // Marking payment as received must set the paid flag, otherwise the
      // row claims money arrived while deposit_paid says it didn't.
      if (status === 'deposit_received') updates.deposit_paid = true;
      const { error } = await supabase
        .from('ut_event_bookings')
        .update(updates)
        .eq('id', id);
      if (error) {
        console.error('UPDATE FAILED ut_event_bookings:', errText(error));
        throw error;
      }
      console.log('UPDATE SUCCESS ut_event_bookings:', id, status);

      // MON-03 settlement loop: a fully-paid booking flipping to
      // confirmed/completed settles into business_transactions via ut-ingest.
      // Idempotent — the ledger dedupes on the booking-derived transaction id.
      let settlement: { settled?: boolean; duplicate?: boolean; error?: string } | null = null;
      if (status === 'confirmed' || status === 'completed') {
        const { data, error: sErr } = await supabase.functions.invoke('settle-event-booking', {
          body: { booking_id: id },
        });
        settlement = sErr ? { error: sErr.message } : data?.settlement ?? (data?.ok === false ? { error: data?.error } : data);
      }
      return settlement;
    },
    onMutate: async ({ id }) => {
      setLoadingId(id);
    },
    onSuccess: (settlement, { id, status }) => {
      queryClient.invalidateQueries({ queryKey: ['ut-event-bookings'] });
      const name = bookings.find(b => b.id === id)?.name || 'Booking';
      const msgs: Record<string, string> = {
        deposit_received: `💰 Payment marked as received for ${name}!`,
        confirmed: `✅ ${name}'s event confirmed!`,
        completed: `🏁 ${name}'s event marked complete!`,
        cancelled: `❌ ${name}'s booking cancelled`,
      };
      toast.success(msgs[status] || 'Updated!');
      if (settlement?.settled && !settlement?.duplicate) {
        toast.success('💵 Settled to ledger (business_transactions)');
      } else if (settlement?.duplicate) {
        toast.info('Already settled in ledger — no duplicate posted');
      } else if (settlement?.error) {
        toast.warning(`Ledger settlement failed: ${settlement.error}`);
      }
    },
    onError: (err: any, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ut-event-bookings'] });
      toast.error(err.message);
    },
    onSettled: () => setLoadingId(null),
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');
  const pendingCount = bookings.filter(b => b.status === 'pending_payment').length;
  const totalRevenue = activeBookings.reduce((s, b) => s + Number(b.full_price || 0), 0);
  const depositsCollected = bookings.filter(b => b.deposit_paid).reduce((s, b) => s + Number(b.deposit_amount || 0), 0);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const renderActionButtons = (b: any) => {
    const isBusy = loadingId === b.id;
    if (b.status === 'completed') return <Badge className="bg-muted text-muted-foreground border-border text-xs px-3 py-1">🏁 Completed</Badge>;

    return (
      <div className="flex gap-1">
        {b.status === 'pending_payment' && (
          <Button size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isBusy}
            onClick={() => updateStatus.mutate({ id: b.id, status: 'deposit_received' })}>
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3 mr-1" />} Mark Paid
          </Button>
        )}
        {b.status === 'deposit_received' && (
          <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white" disabled={isBusy}
            onClick={() => updateStatus.mutate({ id: b.id, status: 'confirmed' })}>
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />} Confirm Event
          </Button>
        )}
        {b.status === 'confirmed' && (
          <Button size="sm" className="text-xs bg-violet-600 hover:bg-violet-700 text-white" disabled={isBusy}
            onClick={() => updateStatus.mutate({ id: b.id, status: 'completed' })}>
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />} Mark Complete
          </Button>
        )}
        {!['completed', 'cancelled'].includes(b.status) && (
          <Button size="sm" variant="outline" className="text-xs text-red-400 border-red-500/40 hover:bg-red-500/10" disabled={isBusy}
            onClick={() => updateStatus.mutate({ id: b.id, status: 'cancelled' })}>
            <XCircle className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar className="h-6 w-6 text-pink-400" /> Event Bookings</h2>
          <p className="text-sm text-muted-foreground">Manage incoming event booking requests</p>
        </div>
        <div className="flex gap-2 items-center">
          {pendingCount > 0 && <Badge variant="outline" className="border-amber-500 text-amber-400">{pendingCount} Pending</Badge>}
          <Badge variant="outline" className="text-sm">{bookings.length} total</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Total Bookings</div>
          <div className="text-2xl font-bold">{bookings.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Revenue Pipeline</div>
          <div className="text-2xl font-bold text-emerald-400">${totalRevenue.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Deposits Collected</div>
          <div className="text-2xl font-bold text-blue-400">${depositsCollected.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Active Bookings ({activeBookings.length})</CardTitle></CardHeader>
        <CardContent>
          {activeBookings.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No pending applications</p>
              <p className="text-sm">All caught up! ✅</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBookings.map(b => {
                  const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending_payment;
                  const isExpanded = expandedIds.has(b.id);
                  return (
                    <>
                      <TableRow key={b.id} className="hover:bg-accent/30 transition-colors">
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleExpand(b.id)}>
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{b.name}</TableCell>
                        <TableCell className="text-sm">{b.event_type || '—'}</TableCell>
                        <TableCell className="text-sm">{b.event_date || '—'}</TableCell>
                        <TableCell className="text-sm">{b.city || '—'}</TableCell>
                        <TableCell className="text-sm">{b.guest_count || '—'}</TableCell>
                        <TableCell className="text-sm">{b.package_name || 'Custom'}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">${Number(b.full_price || 0).toLocaleString()}</div>
                          <div className="text-xs text-blue-400">Deposit: ${Number(b.deposit_amount || 0).toLocaleString()}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs px-3 py-1 ${cfg.classes}`}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {b.created_at ? format(new Date(b.created_at), 'MMM d, yyyy h:mm a') : '—'}
                        </TableCell>
                        <TableCell>{renderActionButtons(b)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${b.id}-detail`} className="bg-accent/10">
                          <TableCell colSpan={11} className="py-4 px-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{b.email || '—'}</span></div>
                              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{b.phone || '—'}</span></div>
                              <div><span className="text-muted-foreground">Budget:</span> {b.budget || '—'}</div>
                              <div><span className="text-muted-foreground">Deposit Paid:</span> {b.deposit_paid ? '✅ Yes' : '❌ No'}</div>
                            </div>
                            {b.preferences && (
                              <div className="mt-3"><span className="text-muted-foreground text-sm">Preferences:</span><p className="text-sm mt-1">{b.preferences}</p></div>
                            )}
                            {b.ai_plan && (
                              <div className="mt-3"><span className="text-muted-foreground text-sm">AI Plan:</span><p className="text-sm mt-1 whitespace-pre-wrap">{typeof b.ai_plan === 'string' ? b.ai_plan : JSON.stringify(b.ai_plan, null, 2)}</p></div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {cancelledBookings.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between border-l-4 border-l-red-500 text-red-400 hover:bg-red-500/10">
              <span>❌ Cancelled ({cancelledBookings.length})</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-l-4 border-l-red-500">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelledBookings.map(b => (
                      <TableRow key={b.id} className="opacity-60">
                        <TableCell className="text-sm">{b.name}</TableCell>
                        <TableCell className="text-sm">{b.event_type || '—'}</TableCell>
                        <TableCell className="text-sm">{b.event_date || '—'}</TableCell>
                        <TableCell className="text-sm">${Number(b.full_price || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
