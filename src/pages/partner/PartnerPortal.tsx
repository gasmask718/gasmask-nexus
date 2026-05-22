import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Partner = {
  id: string;
  business_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  portal_status: string;
};

export default function PartnerPortal() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: p, error: pErr } = await supabase
      .from('tt_partners')
      .select('id, business_name, name, email, phone, portal_status')
      .maybeSingle();
    if (pErr) {
      toast.error(pErr.message);
      setLoading(false);
      return;
    }
    setPartner(p as Partner | null);

    const [{ data: d, error: dErr }, { data: b, error: bErr }] = await Promise.all([
      supabase
        .from('tt_dispatch_requests')
        .select('id, booking_reference, service_type, pickup_location, scheduled_at, status, total_price, accepted_at, expires_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('tt_bookings')
        .select('id, booking_reference, service_type, scheduled_at, status, total_price, pickup_location, dropoff_location')
        .order('scheduled_at', { ascending: false })
        .limit(50),
    ]);
    if (dErr) toast.error(`Dispatch: ${dErr.message}`);
    if (bErr) toast.error(`Bookings: ${bErr.message}`);
    setDispatches(d ?? []);
    setBookings(b ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('tt_dispatch_requests')
      .update({ status, accepted_at: status === 'accepted' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(`Dispatch ${status}`);
    load();
  };

  if (loading) return <div className="p-8">Loading…</div>;
  if (!partner) return <div className="p-8">No partner record linked to your account. Contact admin.</div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{partner.business_name ?? partner.name}</h1>
            <p className="text-sm text-muted-foreground">{partner.email} · {partner.phone}</p>
          </div>
          <Badge variant="secondary">{partner.portal_status}</Badge>
        </div>

        <Tabs defaultValue="dispatches">
          <TabsList>
            <TabsTrigger value="dispatches">Dispatch Requests ({dispatches.length})</TabsTrigger>
            <TabsTrigger value="bookings">Booking History ({bookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="dispatches" className="space-y-3">
            {dispatches.length === 0 && (
              <Card className="p-6 text-sm text-muted-foreground">No dispatch requests yet.</Card>
            )}
            {dispatches.map((d) => (
              <Card key={d.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium">{d.service_type} · {d.booking_reference}</div>
                    <div className="text-sm text-muted-foreground">{d.pickup_location}</div>
                    <div className="text-xs mt-1">{d.scheduled_at && new Date(d.scheduled_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <Badge>{d.status}</Badge>
                    <div className="text-sm mt-1">${d.total_price ?? '—'}</div>
                  </div>
                </div>
                {d.status === 'sent' && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => respond(d.id, 'accepted')}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => respond(d.id, 'declined')}>Decline</Button>
                  </div>
                )}
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="bookings" className="space-y-3">
            {bookings.length === 0 && (
              <Card className="p-6 text-sm text-muted-foreground">No bookings yet.</Card>
            )}
            {bookings.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium">{b.service_type} · {b.booking_reference}</div>
                    <div className="text-sm text-muted-foreground">
                      {b.pickup_location} → {b.dropoff_location}
                    </div>
                    <div className="text-xs mt-1">{b.scheduled_at && new Date(b.scheduled_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <Badge>{b.status}</Badge>
                    <div className="text-sm mt-1">${b.total_price ?? '—'}</div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
