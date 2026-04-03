import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchTopTierData, fetchTopTierCount, patchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, Clock, Zap, Activity, Server, Radio, FileWarning } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

function StatusLight({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-lg p-4">
      <div className={`h-3 w-3 rounded-full ${ok === null ? 'bg-white/20' : ok ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
      <span className="text-white/70">{label}</span>
      <span className={`ml-auto text-sm font-semibold ${ok === null ? 'text-white/30' : ok ? 'text-emerald-400' : 'text-red-400'}`}>
        {ok === null ? 'Checking...' : ok ? 'Healthy' : 'Issue'}
      </span>
    </div>
  );
}

export default function TTOperations() {
  const queryClient = useQueryClient();
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [realtimeOk, setRealtimeOk] = useState<boolean | null>(null);
  const [dispatchBookingId, setDispatchBookingId] = useState('');
  const [dispatchPartnerId, setDispatchPartnerId] = useState('');

  // Problem queue: pending bookings older than 2 hours
  const { data: staleBookings, isLoading: staleLoading } = useQuery({
    queryKey: ['tt-stale-bookings'],
    queryFn: async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from('tt_bookings').select('*').eq('status', 'pending').lt('created_at', twoHoursAgo).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // All pending bookings for dispatch
  const { data: pendingBookings } = useQuery({
    queryKey: ['tt-pending-bookings'],
    queryFn: async () => {
      const { data } = await supabase.from('tt_bookings').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Active partners for dispatch
  const { data: activePartners } = useQuery({
    queryKey: ['tt-active-partners-ops'],
    queryFn: async () => {
      const { data } = await supabase.from('tt_partners').select('id, name, service_category').eq('status', 'active');
      return data || [];
    },
  });

  // System health: pending confirmations
  const { data: pendingConfirmations } = useQuery({
    queryKey: ['tt-pending-confirmations'],
    queryFn: async () => {
      const { data } = await supabase.from('tt_confirmation_requests').select('id').eq('status', 'pending');
      return data?.length || 0;
    },
  });

  // Bookings without partner
  const { data: unassignedCount } = useQuery({
    queryKey: ['tt-unassigned-bookings'],
    queryFn: async () => {
      const { data } = await supabase.from('tt_bookings').select('id').is('partner_id', null).eq('status', 'pending');
      return data?.length || 0;
    },
  });

  // Health checks
  useEffect(() => {
    (async () => {
      try {
        const { error } = await supabase.from('tt_bookings').select('id').limit(1);
        setDbOk(!error);
      } catch { setDbOk(false); }
    })();

    const channel = supabase.channel('ops-health-check')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tt_bookings' }, () => {})
      .subscribe((status) => { setRealtimeOk(status === 'SUBSCRIBED'); });
    return () => { supabase.removeChannel(channel); };
  }, []);

  const reassignMutation = useMutation({
    mutationFn: async ({ bookingId, partnerId }: { bookingId: string; partnerId: string }) => {
      const partner = activePartners?.find(p => p.id === partnerId);
      const { error } = await supabase.from('tt_bookings').update({ partner_id: partnerId, partner_name: partner?.name || '', status: 'confirmed' }).eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-stale-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tt-pending-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tt-unassigned-bookings'] });
      toast.success('Booking dispatched successfully');
      setDispatchBookingId('');
      setDispatchPartnerId('');
    },
  });

  const selectedBooking = pendingBookings?.find(b => b.id === dispatchBookingId);
  const matchingPartners = activePartners?.filter(p => !selectedBooking?.service_type || p.service_category === selectedBooking.service_type) || activePartners || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Activity className="h-6 w-6 text-[#C9A84C]" /> Operations Center</h1>
        <p className="text-white/40 text-sm">Monitor, dispatch, and resolve</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Section 1: Problem Queue */}
        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-400" /> Problem Queue
              {(staleBookings?.length || 0) > 0 && <Badge className="bg-red-500/20 text-red-400 ml-2">{staleBookings!.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
            {staleLoading ? <Skeleton className="h-20 bg-white/5" /> :
              (staleBookings || []).length === 0 ? (
                <div className="text-center py-8 text-white/30">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                  <p>No stuck bookings</p>
                </div>
              ) : staleBookings!.map(b => (
                <div key={b.id} className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">{b.service_name}</p>
                      <p className="text-xs text-white/40">{b.client_name}</p>
                    </div>
                    <Badge className="bg-red-500/20 text-red-400">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDistanceToNow(new Date(b.created_at))} stuck
                    </Badge>
                  </div>
                  <Button size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
                    setDispatchBookingId(b.id);
                  }}>
                    <Zap className="h-3.5 w-3.5 mr-1" /> Reassign
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Section 2: Manual Dispatch */}
        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-[#C9A84C]" /> Manual Dispatch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Select Booking</label>
              <Select value={dispatchBookingId} onValueChange={setDispatchBookingId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Choose a pending booking..." /></SelectTrigger>
                <SelectContent>
                  {(pendingBookings || []).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.service_name} — {b.client_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dispatchBookingId && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-white/40">Booking Details</p>
                <p className="text-white">{selectedBooking?.service_name}</p>
                <p className="text-xs text-white/40">{selectedBooking?.client_name} • {selectedBooking?.service_type} • ${Number(selectedBooking?.total_price || 0).toLocaleString()}</p>
              </div>
            )}

            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Assign Partner</label>
              <Select value={dispatchPartnerId} onValueChange={setDispatchPartnerId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Choose a partner..." /></SelectTrigger>
                <SelectContent>
                  {matchingPartners.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.service_category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full bg-[#C9A84C] hover:bg-[#B8973F] text-black"
              disabled={!dispatchBookingId || !dispatchPartnerId || reassignMutation.isPending}
              onClick={() => reassignMutation.mutate({ bookingId: dispatchBookingId, partnerId: dispatchPartnerId })}
            >
              {reassignMutation.isPending ? 'Dispatching...' : 'Dispatch Booking'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Section 3: System Health */}
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Server className="h-5 w-5 text-[#C9A84C]" /> System Health
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <StatusLight ok={dbOk} label="Database Connection" />
          <StatusLight ok={realtimeOk} label="Realtime Subscription" />
          <div className="flex items-center gap-3 bg-white/5 rounded-lg p-4">
            <div className={`h-3 w-3 rounded-full ${(pendingConfirmations || 0) > 5 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-white/70">Pending Confirmations</span>
            <span className={`ml-auto text-sm font-semibold ${(pendingConfirmations || 0) > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {pendingConfirmations ?? '...'}
            </span>
          </div>
          <div className="flex items-center gap-3 bg-white/5 rounded-lg p-4">
            <div className={`h-3 w-3 rounded-full ${(unassignedCount || 0) > 3 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-white/70">Unassigned Bookings</span>
            <span className={`ml-auto text-sm font-semibold ${(unassignedCount || 0) > 3 ? 'text-red-400' : 'text-emerald-400'}`}>
              {unassignedCount ?? '...'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
