
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Users, DollarSign, PartyPopper, AlertTriangle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const today = () => new Date().toISOString().split('T')[0];

export default function UTDailySummary() {
  const { data: bookings } = useQuery({
    queryKey: ['ut-daily-bookings'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_event_bookings' as any).select('*').gte('created_at', today()) as any);
      return (data || []) as any[];
    },
  });

  const { data: ambassadors } = useQuery({
    queryKey: ['ut-daily-ambassadors'],
    queryFn: async () => {
      const { data } = await (supabase.from('unforgettable_ambassadors' as any).select('*').gte('created_at', today()) as any);
      return (data || []) as any[];
    },
  });

  const { data: consultations } = useQuery({
    queryKey: ['ut-daily-consults'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_business_consultations' as any).select('*').gte('created_at', today()) as any);
      return (data || []) as any[];
    },
  });

  const { data: kitOrders } = useQuery({
    queryKey: ['ut-daily-kits'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_kit_orders' as any).select('*').gte('created_at', today()) as any);
      return (data || []) as any[];
    },
  });

  const { data: pendingConsults } = useQuery({
    queryKey: ['ut-pending-consults'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_business_consultations' as any).select('*').eq('status', 'pending') as any);
      return (data || []) as any[];
    },
  });

  const revenueToday = (bookings || []).reduce((s: number, b: any) => s + Number(b.total_price || b.budget || 0), 0);

  const feedItems = [
    ...(bookings || []).map((b: any) => ({ time: b.created_at, icon: '🎉', desc: `New booking: ${b.event_type || 'Event'} — $${b.total_price || b.budget || 0}`, type: 'booking' })),
    ...(ambassadors || []).map((a: any) => ({ time: a.created_at, icon: '🤝', desc: `New ambassador: ${a.full_name || a.name || 'Unknown'}`, type: 'ambassador' })),
    ...(consultations || []).map((c: any) => ({ time: c.created_at, icon: '📞', desc: `New consultation: ${c.name}`, type: 'consultation' })),
    ...(kitOrders || []).map((k: any) => ({ time: k.created_at, icon: '📦', desc: `New kit order: ${k.kit_name} — $${k.total_paid || 0}`, type: 'kit' })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📊 Daily Command Feed</h1>
        <p className="text-muted-foreground">Everything that happened today across all of Dynasty OS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><DollarSign className="mx-auto h-6 w-6 text-green-500 mb-1" /><p className="text-2xl font-bold">${revenueToday.toLocaleString()}</p><p className="text-xs text-muted-foreground">Revenue Today</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><CalendarDays className="mx-auto h-6 w-6 text-blue-500 mb-1" /><p className="text-2xl font-bold">{(bookings || []).length}</p><p className="text-xs text-muted-foreground">New Bookings</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><Users className="mx-auto h-6 w-6 text-purple-500 mb-1" /><p className="text-2xl font-bold">{(ambassadors || []).length}</p><p className="text-xs text-muted-foreground">New Leads</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><PartyPopper className="mx-auto h-6 w-6 text-pink-500 mb-1" /><p className="text-2xl font-bold">{feedItems.length}</p><p className="text-xs text-muted-foreground">Total Events</p></CardContent></Card>
      </div>

      {(pendingConsults || []).length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Attention Needed</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm">🔴 {(pendingConsults || []).length} consultations pending &gt; 24hrs</p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button size="sm" asChild><Link to="/os/unforgettable/event-bookings"><Plus className="h-4 w-4 mr-1" />New Booking</Link></Button>
        <Button size="sm" variant="outline" asChild><Link to="/os/unforgettable/leads">+ New Lead</Link></Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Activity Feed</CardTitle></CardHeader>
        <CardContent>
          {feedItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity today yet.</p>
          ) : (
            <div className="space-y-2">
              {feedItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-lg">{item.icon}</span>
                  <span className="flex-1 text-sm">{item.desc}</span>
                  <span className="text-xs text-muted-foreground">{item.time ? format(new Date(item.time), 'h:mm a') : ''}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
