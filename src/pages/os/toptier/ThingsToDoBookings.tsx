import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CalendarCheck, DollarSign, Clock, CheckCircle2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  confirmed: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-emerald-500/10 text-emerald-600',
  cancelled: 'bg-red-500/10 text-red-600',
};

export default function ThingsToDoBookings() {
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['experience_bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_bookings')
        .select('*, experiences_master(title, city, category, display_price)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('experience_bookings_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experience_bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['experience_bookings'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('experience_bookings')
        .update({ booking_status: status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Booking status updated');
      queryClient.invalidateQueries({ queryKey: ['experience_bookings'] });
    },
  });

  const totalRevenue = bookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
  const pending = bookings.filter((b: any) => b.booking_status === 'pending').length;
  const confirmed = bookings.filter((b: any) => b.booking_status === 'confirmed').length;
  const completed = bookings.filter((b: any) => b.booking_status === 'completed').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-blue-500" />
          Things To Do — Bookings
        </h1>
        <p className="text-muted-foreground text-sm">Real-time booking management with status tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total Bookings</p>
          <p className="text-2xl font-bold">{bookings.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</p>
          <p className="text-2xl font-bold text-amber-500">{pending}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Confirmed</p>
          <p className="text-2xl font-bold text-blue-500">{confirmed}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Revenue</p>
          <p className="text-2xl font-bold text-emerald-500">${totalRevenue.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Experience</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Add-ons</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : bookings.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No bookings yet</TableCell></TableRow>
              ) : (
                bookings.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{b.experiences_master?.title || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{b.experiences_master?.city} • {b.experiences_master?.category}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{b.customer_name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{b.customer_email}</p>
                    </TableCell>
                    <TableCell>
                      {Array.isArray(b.selected_addons) && b.selected_addons.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {b.selected_addons.map((a: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{a.name || a}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">${Number(b.total_price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[b.booking_status] || ''}`}>
                        {b.booking_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={b.booking_status}
                        onValueChange={(v) => updateStatus.mutate({ id: b.id, status: v })}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
