import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, User, Clock, AlertTriangle, RefreshCw, Radio } from 'lucide-react';
import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-500/20 text-blue-400',
  driver_assigned: 'bg-emerald-500/20 text-emerald-400',
  en_route: 'bg-amber-500/20 text-amber-400',
  arrived: 'bg-purple-500/20 text-purple-400',
  in_progress: 'bg-[#C9A84C]/20 text-[#C9A84C]',
  pending: 'bg-red-500/20 text-red-400',
};

export default function TTDispatch() {
  const queryClient = useQueryClient();
  const [assignModal, setAssignModal] = useState<any>(null);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);

  // Tick counter every second
  useEffect(() => {
    const t = setInterval(() => setLastUpdated(prev => prev + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Live bookings queue
  const { data: bookings, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['tt-dispatch-bookings'],
    queryFn: () => fetchTopTierData('tt_bookings', {
      select: '*',
      filters: { 'status': 'in.(pending,confirmed,driver_assigned,en_route,arrived,in_progress)' },
      order: 'scheduled_at.asc',
    }),
    refetchInterval: 60000,
  });

  // Reset counter on refetch
  useEffect(() => { setLastUpdated(0); }, [dataUpdatedAt]);

  // Available drivers
  const { data: drivers } = useQuery({
    queryKey: ['tt-dispatch-drivers'],
    queryFn: () => fetchTopTierData('tt_drivers', {
      select: '*',
      filters: { 'status': 'in.(available,off_duty)' },
      order: 'rating.desc',
    }),
    refetchInterval: 60000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('tt-dispatch-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tt_bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tt-dispatch-bookings'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tt_dispatches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tt-dispatch-bookings'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const urgentBookings = useMemo(() => {
    if (!bookings) return [];
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return bookings.filter((b: any) =>
      !b.driver_id && b.scheduled_at && new Date(b.scheduled_at) < twoHoursFromNow
    );
  }, [bookings]);

  const isUrgent = (b: any) => urgentBookings.some((u: any) => u.id === b.id);

  const openAssignModal = async (booking: any) => {
    setAssignModal(booking);
    setDriversLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tt-get-driver-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ pickup_datetime: booking.scheduled_at }),
      });
      const data = await res.json();
      setAvailableDrivers(data.available_drivers || []);
    } catch { setAvailableDrivers([]); }
    setDriversLoading(false);
  };

  const assignDriver = useMutation({
    mutationFn: async ({ booking_id, driver_id }: { booking_id: string; driver_id: string }) => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tt-assign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ booking_id, driver_id }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tt-dispatch-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tt-dispatch-drivers'] });
      setAssignModal(null);
      toast.success(`Driver ${data.driver_name} assigned`);
    },
    onError: () => toast.error('Assignment failed'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ booking_id, new_status }: { booking_id: string; new_status: string }) => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tt-update-booking-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ booking_id, new_status }),
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-dispatch-bookings'] });
      toast.success('Status updated');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white/90 flex items-center gap-2">
            <Radio className="h-5 w-5 text-[#C9A84C]" />
            Dispatch Center
          </h1>
          <p className="text-sm text-white/40">Live booking queue with real-time updates</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30">Last updated {lastUpdated}s ago</span>
          <Badge className="bg-emerald-500/20 text-emerald-400 animate-pulse">LIVE</Badge>
        </div>
      </div>

      {/* Urgency Banner */}
      {urgentBookings.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 animate-pulse">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <span className="text-sm text-amber-400 font-semibold">
                ⚠ {urgentBookings.length} booking(s) pickup within 2 hours — NO DRIVER ASSIGNED
              </span>
            </div>
            {urgentBookings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between bg-amber-500/10 rounded-lg px-3 py-2">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-mono text-amber-400">{b.booking_reference || b.id?.slice(0, 8)}</span>
                  <span className="text-white/70">{b.client_name}</span>
                  <span className="text-white/50">{b.scheduled_at ? format(new Date(b.scheduled_at), 'h:mm a') : '—'}</span>
                </div>
                <Button size="sm" className="h-6 text-[10px] bg-amber-500 text-black hover:bg-amber-400" onClick={() => openAssignModal(b)}>
                  Assign Now
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-[#111111] border-[#C9A84C]/10 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white/70">Active Bookings Queue</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/5">
                  <tr>
                    {['Ref', 'Customer', 'Pickup', 'Dropoff', 'Time', 'Status', 'Driver', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-white/40 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoading ? Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={8} className="p-3"><Skeleton className="h-8 bg-white/5" /></td></tr>) :
                    !bookings?.length ? <tr><td colSpan={8} className="p-8 text-center text-white/30">No active bookings</td></tr> :
                    bookings.map((b: any) => (
                      <tr key={b.id} className={`hover:bg-white/[0.02] ${isUrgent(b) ? 'bg-red-500/5 border-l-4 border-l-red-500' : ''}`}>
                        <td className="px-3 py-3 text-xs font-mono text-[#C9A84C] flex items-center gap-1.5">
                          {isUrgent(b) && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" />}
                          {b.booking_reference || b.id?.slice(0, 8)}
                        </td>
                        <td className="px-3 py-3 text-sm text-white/80">{b.client_name}</td>
                        <td className="px-3 py-3 text-xs text-white/60 max-w-[120px] truncate">{b.pickup_location || b.pickup_city || '—'}</td>
                        <td className="px-3 py-3 text-xs text-white/60 max-w-[120px] truncate">{b.dropoff_location || b.dropoff_city || '—'}</td>
                        <td className="px-3 py-3 text-xs text-white/60">{b.scheduled_at ? format(new Date(b.scheduled_at), 'h:mm a') : '—'}</td>
                        <td className="px-3 py-3"><Badge className={`text-[10px] ${STATUS_COLORS[b.status] || ''}`}>{b.status}</Badge></td>
                        <td className="px-3 py-3">
                          {b.driver_id ? (
                            <span className="text-xs text-emerald-400">Assigned</span>
                          ) : (
                            <span className="text-xs text-red-400 font-medium">UNASSIGNED</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            {!b.driver_id && (
                              <Button size="sm" className="h-6 text-[10px] bg-[#C9A84C] text-black" onClick={() => openAssignModal(b)}>
                                Assign
                              </Button>
                            )}
                            <Select onValueChange={(v) => updateStatus.mutate({ booking_id: b.id, new_status: v })}>
                              <SelectTrigger className="h-6 w-20 text-[10px] bg-white/5 border-white/10 text-white/60">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#1A1A1A] border-white/10">
                                <SelectItem value="en_route">En Route</SelectItem>
                                <SelectItem value="arrived">Arrived</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card className="bg-[#111111] border-[#C9A84C]/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70 flex items-center gap-2"><User className="h-4 w-4 text-emerald-400" />Available Drivers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {(drivers || []).filter((d: any) => d.status === 'available').length === 0 ? (
              <p className="text-xs text-white/30 text-center py-4">No drivers available</p>
            ) : (drivers || []).filter((d: any) => d.status === 'available').map((d: any) => (
              <div key={d.id} className="p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-white/80 font-medium">{d.full_name}</span>
                </div>
                <div className="mt-1 text-[10px] text-white/40">
                  ⭐ {d.rating || '—'} · {d.vehicle_make} {d.vehicle_model} · {d.license_plate || '—'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Assign Driver Modal */}
      <Dialog open={!!assignModal} onOpenChange={(o) => !o && setAssignModal(null)}>
        <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white">
          <DialogHeader><DialogTitle>Assign Driver — {assignModal?.booking_reference || assignModal?.id?.slice(0, 8)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-sm text-white/60">{assignModal?.client_name} · {assignModal?.pickup_location || assignModal?.pickup_city}</p>
              <p className="text-xs text-white/40">{assignModal?.scheduled_at ? format(new Date(assignModal.scheduled_at), 'PPp') : '—'}</p>
            </div>
            {driversLoading ? <Skeleton className="h-24 bg-white/5" /> :
              availableDrivers.length === 0 ? <p className="text-sm text-white/30 text-center py-4">No drivers available</p> :
              availableDrivers.map((d: any) => (
                <div key={d.driver_id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06]">
                  <div>
                    <p className="text-sm font-medium text-white/80">{d.name}</p>
                    <p className="text-xs text-white/40">⭐ {d.rating || '—'} · {d.vehicle_name} · {d.license_plate}</p>
                  </div>
                  <Button size="sm" className="bg-[#C9A84C] text-black" onClick={() => assignDriver.mutate({ booking_id: assignModal.id, driver_id: d.driver_id })}>
                    Assign
                  </Button>
                </div>
              ))
            }
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
