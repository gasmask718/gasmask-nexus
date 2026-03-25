import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, CheckCircle, XCircle, UserX, Plus, RefreshCw, Link2 } from 'lucide-react';
import { toast } from 'sonner';

const SOLAR_AMBER = '#E8A317';

export default function SolarBookings() {
  const queryClient = useQueryClient();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [newBooking, setNewBooking] = useState({ lead_id: '', scheduled_time: '', meeting_link: '', notes: '' });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['solar-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_appointments')
        .select('*, solar_leads(first_name, last_name, phone, email, address), solar_partners(company_name)')
        .order('scheduled_time', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['solar-leads-for-booking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_leads')
        .select('id, first_name, last_name, phone')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const bookAppointment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('solar-followup-engine', {
        body: {
          action: 'book_appointment',
          lead_id: newBooking.lead_id,
          scheduled_time: newBooking.scheduled_time,
          meeting_link: newBooking.meeting_link,
          notes: newBooking.notes,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Appointment booked!');
      setBookingOpen(false);
      setNewBooking({ lead_id: '', scheduled_time: '', meeting_link: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['solar-appointments'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('solar_appointments').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['solar-appointments'] });
    },
  });

  const scheduled = appointments.filter((a: any) => a.status === 'scheduled');
  const completed = appointments.filter((a: any) => a.status === 'completed');
  const noShows = appointments.filter((a: any) => a.status === 'no_show');
  const cancelled = appointments.filter((a: any) => a.status === 'cancelled');

  const statusBadge = (status: string) => {
    switch (status) {
      case 'scheduled': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Scheduled</Badge>;
      case 'completed': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      case 'no_show': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">No Show</Badge>;
      case 'cancelled': return <Badge variant="outline">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderAppointment = (a: any) => (
    <Card key={a.id} className="border-border/50">
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {a.solar_leads?.first_name} {a.solar_leads?.last_name}
            </p>
            <p className="text-xs text-muted-foreground">{a.solar_leads?.phone} · {a.solar_leads?.address}</p>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">{new Date(a.scheduled_time).toLocaleString()}</span>
              {a.solar_partners?.company_name && (
                <Badge variant="outline" className="text-[10px]">{a.solar_partners.company_name}</Badge>
              )}
            </div>
            {a.meeting_link && (
              <div className="flex items-center gap-1 mt-1">
                <Link2 className="h-3 w-3 text-muted-foreground" />
                <a href={a.meeting_link} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:underline truncate">{a.meeting_link}</a>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusBadge(a.status)}
            {a.status === 'scheduled' && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateStatus.mutate({ id: a.id, status: 'completed' })}>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateStatus.mutate({ id: a.id, status: 'no_show' })}>
                  <UserX className="h-4 w-4 text-red-500" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateStatus.mutate({ id: a.id, status: 'cancelled' })}>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: SOLAR_AMBER }}>📅 Appointment Booking</h1>
          <p className="text-sm text-muted-foreground">Schedule, track, and manage solar consultations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['solar-appointments'] })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: SOLAR_AMBER }}><Plus className="h-4 w-4 mr-2" /> Book</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Book Appointment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Lead</Label>
                  <select
                    className="w-full border rounded-md p-2 bg-background text-foreground text-sm"
                    value={newBooking.lead_id}
                    onChange={(e) => setNewBooking({ ...newBooking, lead_id: e.target.value })}
                  >
                    <option value="">Select lead...</option>
                    {leads.map((l: any) => (
                      <option key={l.id} value={l.id}>{l.first_name} {l.last_name} — {l.phone}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Date & Time</Label>
                  <Input type="datetime-local" value={newBooking.scheduled_time} onChange={(e) => setNewBooking({ ...newBooking, scheduled_time: e.target.value })} />
                </div>
                <div>
                  <Label>Meeting Link (optional)</Label>
                  <Input placeholder="https://..." value={newBooking.meeting_link} onChange={(e) => setNewBooking({ ...newBooking, meeting_link: e.target.value })} />
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Input placeholder="Any notes..." value={newBooking.notes} onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })} />
                </div>
                <Button className="w-full" style={{ backgroundColor: SOLAR_AMBER }} onClick={() => bookAppointment.mutate()} disabled={!newBooking.lead_id || !newBooking.scheduled_time || bookAppointment.isPending}>
                  {bookAppointment.isPending ? 'Booking...' : 'Confirm Booking'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold" style={{ color: SOLAR_AMBER }}>{scheduled.length}</p>
          <p className="text-xs text-muted-foreground">Upcoming</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-green-500">{completed.length}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-red-500">{noShows.length}</p>
          <p className="text-xs text-muted-foreground">No-Shows</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{cancelled.length}</p>
          <p className="text-xs text-muted-foreground">Cancelled</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming"><Calendar className="h-4 w-4 mr-1" /> Upcoming ({scheduled.length})</TabsTrigger>
          <TabsTrigger value="completed"><CheckCircle className="h-4 w-4 mr-1" /> Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="issues"><UserX className="h-4 w-4 mr-1" /> No-Shows ({noShows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-3">
          {scheduled.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No upcoming appointments</CardContent></Card>
          ) : scheduled.map(renderAppointment)}
        </TabsContent>
        <TabsContent value="completed" className="space-y-3">
          {completed.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No completed appointments yet</CardContent></Card>
          ) : completed.map(renderAppointment)}
        </TabsContent>
        <TabsContent value="issues" className="space-y-3">
          {noShows.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No no-shows — great!</CardContent></Card>
          ) : noShows.map(renderAppointment)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
