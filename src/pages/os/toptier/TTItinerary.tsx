import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchTopTierData, patchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Map, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Clock, Users, Zap } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';

function StatusBadge({ status, createdAt }: { status: string; createdAt?: string }) {
  const isPending = status === 'pending';
  const isStale = isPending && createdAt && differenceInMinutes(new Date(), new Date(createdAt)) > 30;
  const colors: Record<string, string> = {
    confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return (
    <Badge className={`${colors[status] || colors.pending} ${isStale ? 'animate-pulse' : ''}`}>
      {status} {isStale && '⚠'}
    </Badge>
  );
}

export default function TTItinerary() {
  const queryClient = useQueryClient();
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [reassignBooking, setReassignBooking] = useState<any>(null);
  const [selectedPartner, setSelectedPartner] = useState('');

  // Fetch bookings grouped by client
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['tt-itinerary-bookings'],
    queryFn: () => fetchTopTierData('bookings', {
      select: '*',
      order: 'scheduled_at.asc',
    }),
  });

  // Fetch active partners for reassignment
  const { data: activePartners } = useQuery({
    queryKey: ['tt-active-partners'],
    queryFn: () => fetchTopTierData('partners', {
      select: 'id,name,service_category',
      filters: { 'status': 'eq.active' },
    }),
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel('tt-itinerary-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tt_bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tt-itinerary-bookings'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const reassignMutation = useMutation({
    mutationFn: async ({ bookingId, partnerId, partnerName }: { bookingId: string; partnerId: string; partnerName: string }) => {
      const { error } = await supabase.from('tt_bookings').update({ partner_id: partnerId, partner_name: partnerName, status: 'confirmed' }).eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-itinerary-bookings'] });
      setReassignBooking(null);
      setSelectedPartner('');
      toast.success('Booking reassigned & confirmed');
    },
  });

  // Group by client
  const clientGroups = (bookings || []).reduce((acc, b) => {
    const key = b.client_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {} as Record<string, any[]>);

  const toggleClient = (name: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const totalItems = bookings?.length || 0;
  const confirmedCount = bookings?.filter(b => b.status === 'confirmed').length || 0;
  const pendingCount = bookings?.filter(b => b.status === 'pending').length || 0;
  const issueCount = bookings?.filter(b => b.status === 'cancelled' || (b.status === 'pending' && b.created_at && differenceInMinutes(new Date(), new Date(b.created_at)) > 30)).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Map className="h-6 w-6 text-[#C9A84C]" /> Live Itinerary Monitor</h1>
        <p className="text-white/40 text-sm">Real-time client booking schedules</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { title: 'Total Items', value: totalItems, icon: Users },
          { title: 'Confirmed', value: confirmedCount, icon: CheckCircle },
          { title: 'Pending', value: pendingCount, icon: Clock },
          { title: 'Issues', value: issueCount, icon: AlertTriangle },
        ].map(s => (
          <Card key={s.title} className="bg-[#111111] border-[#C9A84C]/10">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">{s.title}</p>
                  <p className="text-3xl font-bold text-[#C9A84C] mt-1">{s.value}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[#C9A84C]/10"><s.icon className="h-5 w-5 text-[#C9A84C]" /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 bg-white/5" />)}</div>
      ) : Object.keys(clientGroups).length === 0 ? (
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-12 text-center text-white/30">No itinerary items found</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(clientGroups).map(([clientName, items]) => {
            const isOpen = expandedClients.has(clientName);
            const clientConfirmed = items.filter(i => i.status === 'confirmed').length;
            const clientPending = items.filter(i => i.status === 'pending').length;
            const clientIssues = items.filter(i => i.status === 'cancelled').length;
            const totalValue = items.reduce((s, i) => s + Number(i.total_price || 0), 0);

            return (
              <Collapsible key={clientName} open={isOpen} onOpenChange={() => toggleClient(clientName)}>
                <Card className="bg-[#111111] border-[#C9A84C]/10 hover:border-[#C9A84C]/25 transition-colors">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-[#C9A84C]" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                          <div className="w-10 h-10 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-[#C9A84C] font-bold">
                            {clientName.charAt(0)}
                          </div>
                          <div>
                            <CardTitle className="text-base text-white">{clientName}</CardTitle>
                            <p className="text-xs text-white/40">{items.length} items • ${totalValue.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 text-xs">
                          {clientConfirmed > 0 && <Badge className="bg-emerald-500/20 text-emerald-400">{clientConfirmed} confirmed</Badge>}
                          {clientPending > 0 && <Badge className="bg-amber-500/20 text-amber-400">{clientPending} pending</Badge>}
                          {clientIssues > 0 && <Badge className="bg-red-500/20 text-red-400">{clientIssues} issues</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-2">
                      {items.map(item => (
                        <div key={item.id} className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{item.service_name}</span>
                              <StatusBadge status={item.status} createdAt={item.created_at} />
                            </div>
                            <p className="text-xs text-white/40 mt-1">
                              {item.scheduled_at ? format(new Date(item.scheduled_at), 'MMM d, yyyy h:mm a') : 'Not scheduled'}
                              {item.partner_name && ` • ${item.partner_name}`}
                              {' • '}${Number(item.total_price || 0).toLocaleString()}
                            </p>
                          </div>
                          {item.status === 'pending' && (
                            <Button size="sm" variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 ml-3" onClick={() => setReassignBooking(item)}>
                              <Zap className="h-3.5 w-3.5 mr-1" /> Assign
                            </Button>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Reassign Modal */}
      {reassignBooking && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setReassignBooking(null)}>
          <Card className="bg-[#111111] border-[#C9A84C]/20 w-[420px]" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-white">Assign Partner</CardTitle>
              <p className="text-sm text-white/40">{reassignBooking.service_name} — {reassignBooking.client_name}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select partner..." /></SelectTrigger>
                <SelectContent>
                  {(activePartners || [])
                    .filter(p => !reassignBooking.service_type || p.service_category === reassignBooking.service_type || true)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.service_category}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-white/10 text-white/60" onClick={() => setReassignBooking(null)}>Cancel</Button>
                <Button
                  className="flex-1 bg-[#C9A84C] hover:bg-[#B8973F] text-black"
                  disabled={!selectedPartner || reassignMutation.isPending}
                  onClick={() => {
                    const partner = activePartners?.find(p => p.id === selectedPartner);
                    reassignMutation.mutate({ bookingId: reassignBooking.id, partnerId: selectedPartner, partnerName: partner?.name || '' });
                  }}
                >
                  {reassignMutation.isPending ? 'Dispatching...' : 'Dispatch'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
