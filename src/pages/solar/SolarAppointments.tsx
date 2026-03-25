import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileText, CalendarDays, Clock, CheckCircle, XCircle, Plus, Phone } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const AMBER = '#E8A317';

export default function SolarAppointments() {
  const queryClient = useQueryClient();
  const [showBook, setShowBook] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [apptDate, setApptDate] = useState('');

  // Get leads that are qualified / appointment_booked
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['solar-appt-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_leads')
        .select('*')
        .in('status', ['qualified', 'appointment_booked'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const bookAppointment = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('solar_leads')
        .update({ status: 'appointment_booked' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solar-appt-leads'] });
      toast.success('Appointment booked!');
      setShowBook(false);
    },
  });

  const bookedCount = leads.filter((l: any) => l.status === 'appointment_booked').length;
  const qualifiedCount = leads.filter((l: any) => l.status === 'qualified').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" style={{ color: AMBER }} />
            Floor 4 — Appointment Booking Engine
          </h1>
          <p className="text-muted-foreground">Auto-book, confirm, and manage solar consultations</p>
        </div>
        <Button style={{ backgroundColor: AMBER, color: '#000' }} onClick={() => setShowBook(true)}>
          <Plus className="h-4 w-4 mr-1" /> Book Appointment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Ready to Book', value: qualifiedCount, icon: Clock, color: 'text-blue-400' },
          { label: 'Booked', value: bookedCount, icon: CalendarDays, color: 'text-green-400' },
          { label: 'Total Pipeline', value: leads.length, icon: FileText, color: 'text-yellow-400' },
          { label: 'Book Rate', value: leads.length ? `${((bookedCount / leads.length) * 100).toFixed(0)}%` : '0%', icon: CheckCircle, color: 'text-emerald-400' },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Appointments Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Appointment Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : !leads.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No qualified leads ready for appointments</TableCell></TableRow>
              ) : (
                leads.map((lead: any) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <p className="font-medium">{lead.full_name}</p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">{lead.phone || '—'}</TableCell>
                    <TableCell className="text-sm">{lead.city}, {lead.state}</TableCell>
                    <TableCell>
                      <span className="font-bold" style={{ color: AMBER }}>{lead.lead_score || 0}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lead.status === 'appointment_booked' ? 'default' : 'secondary'}>
                        {lead.status === 'appointment_booked' ? '✅ Booked' : '⏳ Ready'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {lead.status === 'qualified' && (
                          <Button
                            size="sm"
                            className="text-xs h-7"
                            style={{ backgroundColor: AMBER, color: '#000' }}
                            onClick={() => bookAppointment.mutate({ id: lead.id })}
                          >
                            <CalendarDays className="h-3 w-3 mr-1" /> Book
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          <Phone className="h-3 w-3 mr-1" /> Call
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Book Dialog */}
      <Dialog open={showBook} onOpenChange={setShowBook}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Lead</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedLead || ''}
                onChange={(e) => setSelectedLead(e.target.value)}
              >
                <option value="">Choose a qualified lead…</option>
                {leads.filter((l: any) => l.status === 'qualified').map((l: any) => (
                  <option key={l.id} value={l.id}>{l.full_name} — {l.city}, {l.state}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Appointment Date/Time</Label>
              <Input type="datetime-local" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
            </div>
            <Button
              className="w-full"
              style={{ backgroundColor: AMBER, color: '#000' }}
              disabled={!selectedLead}
              onClick={() => selectedLead && bookAppointment.mutate({ id: selectedLead })}
            >
              Confirm Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
