// ═══════════════════════════════════════════════════════════════════════════
// MON-02 — Daily Command Feed. Errors thrown, no budget-as-revenue.
// ═══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, PartyPopper, AlertTriangle, Plus, FileSignature } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { isConfirmed, pipelineValue, contractedValue, lastWritten, formatLastUpdated, money } from './utRevenue';
import { errText } from "@/lib/errText";

const today = () => new Date().toISOString().split('T')[0];

function useToday(key: string, table: string, extra?: (q: any) => any) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => {
      let q = (supabase.from(table as any).select('*') as any).gte('created_at', today());
      if (extra) q = extra(q);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export default function UTDailySummary() {
  const { data: bookings, error: bookingsError } = useToday('ut-daily-bookings', 'ut_event_bookings');
  const { data: ambassadors, error: ambassadorsError } = useToday('ut-daily-ambassadors', 'unforgettable_ambassadors');
  const { data: consultations, error: consultationsError } = useToday('ut-daily-consults', 'ut_business_consultations');
  const { data: kitOrders, error: kitError } = useToday('ut-daily-kits', 'ut_kit_orders');

  const { data: pendingConsults, error: pendingError } = useQuery({
    queryKey: ['ut-pending-consults'],
    queryFn: async () => {
      const { data, error } = await (
        supabase.from('ut_business_consultations' as any).select('*').eq('status', 'pending') as any
      );
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const rows = bookings || [];
  const contractedToday = rows.filter(isConfirmed).reduce((s, b) => s + contractedValue(b), 0);
  const pipelineToday = rows.filter((b) => !isConfirmed(b)).reduce((s, b) => s + pipelineValue(b), 0);
  const bookingsStamp = formatLastUpdated(lastWritten(rows));

  const errors = [bookingsError, ambassadorsError, consultationsError, kitError, pendingError].filter(Boolean);

  const feedItems = [
    ...rows.map((b: any) => ({
      time: b.created_at,
      icon: '🎉',
      desc: `New booking: ${b.event_type || 'Event'} — ${
        isConfirmed(b) ? `${money(contractedValue(b))} contracted` : `${money(pipelineValue(b))} pipeline`
      }`,
    })),
    ...(ambassadors || []).map((a: any) => ({
      time: a.created_at,
      icon: '🤝',
      desc: `New ambassador: ${a.full_name || a.name || 'Unknown'}`,
    })),
    ...(consultations || []).map((c: any) => ({ time: c.created_at, icon: '📞', desc: `New consultation: ${c.name}` })),
    ...(kitOrders || []).map((k: any) => ({
      time: k.created_at,
      icon: '📦',
      desc: `New kit order: ${k.kit_name} — ${money(Number(k.total_paid || 0))}`,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const stamp = (text: string) => <p className="text-[11px] text-muted-foreground/70 mt-2">{text}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📊 Daily Command Feed</h1>
        <p className="text-muted-foreground">Everything that happened today across all of Dynasty OS</p>
      </div>

      {errors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Data could not be read
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {errors.map((e: any, i) => (
              <p key={i} className="text-xs text-destructive">
                {errText(e)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <FileSignature className="mx-auto h-6 w-6 text-green-500 mb-1" />
            <p className="text-2xl font-bold">{money(contractedToday)}</p>
            <p className="text-xs text-muted-foreground">Contracted today</p>
            {stamp(`ut_event_bookings — ${bookingsStamp}`)}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarDays className="mx-auto h-6 w-6 text-blue-500 mb-1" />
            <p className="text-2xl font-bold">{money(pipelineToday)}</p>
            <p className="text-xs text-muted-foreground">Pipeline today ({rows.length} new bookings)</p>
            {stamp(`ut_event_bookings — ${bookingsStamp}`)}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="mx-auto h-6 w-6 text-purple-500 mb-1" />
            <p className="text-2xl font-bold">{(ambassadors || []).length}</p>
            <p className="text-xs text-muted-foreground">New Leads</p>
            {stamp(`unforgettable_ambassadors — ${formatLastUpdated(lastWritten(ambassadors))}`)}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <PartyPopper className="mx-auto h-6 w-6 text-pink-500 mb-1" />
            <p className="text-2xl font-bold">{feedItems.length}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
            {stamp('all four sources, today only')}
          </CardContent>
        </Card>
      </div>

      {(pendingConsults || []).length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Attention Needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm">🔴 {(pendingConsults || []).length} consultations pending</p>
            {stamp(`ut_business_consultations — ${formatLastUpdated(lastWritten(pendingConsults))}`)}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button size="sm" asChild>
          <Link to="/os/unforgettable/event-bookings">
            <Plus className="h-4 w-4 mr-1" />
            New Booking
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/os/unforgettable/leads">+ New Lead</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          {feedItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity today yet.</p>
          ) : (
            <div className="space-y-2">
              {feedItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-lg">{item.icon}</span>
                  <span className="flex-1 text-sm">{item.desc}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.time ? format(new Date(item.time), 'h:mm a') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
