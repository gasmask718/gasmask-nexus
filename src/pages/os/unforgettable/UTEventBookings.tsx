import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, DollarSign, Users, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; icon: string; classes: string }> = {
  pending_payment: { label: '⏳ Pending Payment', icon: '⏳', classes: 'bg-amber-500/10 text-amber-700 border-amber-300' },
  deposit_received: { label: '💰 Deposit Received', icon: '💰', classes: 'bg-blue-500/10 text-blue-700 border-blue-300' },
  confirmed: { label: '✅ Confirmed', icon: '✅', classes: 'bg-emerald-500/10 text-emerald-700 border-emerald-300' },
  in_progress: { label: '🎉 In Progress', icon: '🎉', classes: 'bg-violet-500/10 text-violet-700 border-violet-300' },
  completed: { label: '🏁 Completed', icon: '🏁', classes: 'bg-muted text-muted-foreground border-border' },
  cancelled: { label: '❌ Cancelled', icon: '❌', classes: 'bg-red-500/10 text-red-700 border-red-300' },
};

function useEventBookings() {
  return useQuery({
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
}

export default function UTEventBookings() {
  const { data: bookings = [], isLoading } = useEventBookings();
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('ut_event_bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['ut-event-bookings'] });
      toast.success(`Booking ${status === 'confirmed' ? '✅ confirmed' : status === 'cancelled' ? '❌ cancelled' : 'updated'}!`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

  const totalRevenue = bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + Number(b.full_price || 0), 0);
  const depositsCollected = bookings.filter(b => b.deposit_paid).reduce((s, b) => s + Number(b.deposit_amount || 0), 0);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Event Bookings</h2>
          <p className="text-sm text-muted-foreground">Manage incoming event booking requests</p>
        </div>
        <Badge variant="outline" className="text-sm">{bookings.length} total</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Total Bookings</div>
          <div className="text-2xl font-bold">{bookings.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{bookings.filter(b => b.status === 'pending_payment').length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Revenue Pipeline</div>
          <div className="text-2xl font-bold text-emerald-600">${totalRevenue.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Deposits Collected</div>
          <div className="text-2xl font-bold text-blue-600">${depositsCollected.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      {/* Active Bookings Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Active Bookings ({activeBookings.length})</CardTitle></CardHeader>
        <CardContent>
          {activeBookings.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No bookings yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{b.name}</div>
                        <div className="text-xs text-muted-foreground">{b.email}</div>
                        <div className="text-xs text-muted-foreground">{b.phone}</div>
                      </TableCell>
                      <TableCell className="text-sm">{b.event_type || '—'}</TableCell>
                      <TableCell className="text-sm">{b.event_date || '—'}</TableCell>
                      <TableCell className="text-sm">{b.city || '—'}</TableCell>
                      <TableCell className="text-sm">{b.guest_count || '—'}</TableCell>
                      <TableCell className="text-sm">{b.package_name || 'Custom'}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">${Number(b.full_price || 0).toLocaleString()}</div>
                        {b.deposit_paid && <div className="text-xs text-emerald-600">Deposit: ${Number(b.deposit_amount).toLocaleString()}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs px-3 py-1 ${cfg.classes}`}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {b.created_at ? format(new Date(b.created_at), 'MMM d, yyyy h:mm a') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {b.status === 'pending_payment' && (
                            <Button size="sm" variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-700"
                              disabled={updateStatus.isPending}
                              onClick={() => updateStatus.mutate({ id: b.id, status: 'deposit_received' })}>
                              {updateStatus.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3 mr-1" />}
                              Mark Paid
                            </Button>
                          )}
                          {b.status === 'deposit_received' && (
                            <Button size="sm" variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-700"
                              disabled={updateStatus.isPending}
                              onClick={() => updateStatus.mutate({ id: b.id, status: 'confirmed' })}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
                            </Button>
                          )}
                          {b.status === 'confirmed' && (
                            <Button size="sm" variant="default" className="text-xs bg-violet-600 hover:bg-violet-700"
                              disabled={updateStatus.isPending}
                              onClick={() => updateStatus.mutate({ id: b.id, status: 'completed' })}>
                              Complete
                            </Button>
                          )}
                          {!['completed', 'cancelled'].includes(b.status) && (
                            <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200"
                              disabled={updateStatus.isPending}
                              onClick={() => updateStatus.mutate({ id: b.id, status: 'cancelled' })}>
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cancelled */}
      {cancelledBookings.length > 0 && (
        <Card className="border-l-4 border-l-red-400">
          <CardHeader><CardTitle className="text-lg text-red-600">Cancelled ({cancelledBookings.length})</CardTitle></CardHeader>
          <CardContent>
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
      )}
    </div>
  );
}
