
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-500', pending: 'bg-yellow-500', pending_payment: 'bg-yellow-500',
  deposit_received: 'bg-blue-500', completed: 'bg-gray-500', cancelled: 'bg-red-500',
};

export default function UTEventCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [filter, setFilter] = useState('all');

  const { data: bookings } = useQuery({
    queryKey: ['ut-calendar-bookings'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_event_bookings' as any).select('*') as any);
      return (data || []) as any[];
    },
  });

  const filtered = useMemo(() => {
    if (filter === 'all') return bookings || [];
    return (bookings || []).filter((b: any) => b.status === filter);
  }, [bookings, filter]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = getDay(startOfMonth(currentMonth));

  const getEventsForDay = (day: Date) =>
    filtered.filter((b: any) => b.event_date && isSameDay(new Date(b.event_date), day));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📅 Event Calendar</h1>
        <p className="text-muted-foreground">All bookings at a glance</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'confirmed', 'pending', 'deposit_received', 'completed', 'cancelled'].map(s => (
          <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)} className="capitalize">{s.replace('_', ' ')}</Button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft /></Button>
          <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight /></Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
              const events = getEventsForDay(day);
              return (
                <div key={day.toISOString()} className="min-h-[80px] border border-border rounded p-1 text-xs">
                  <span className="font-medium">{format(day, 'd')}</span>
                  {events.slice(0, 3).map((ev: any, i: number) => (
                    <button key={i} onClick={() => setSelectedEvent(ev)} className={`block w-full text-left text-[10px] mt-0.5 px-1 rounded text-white truncate ${STATUS_COLORS[ev.status] || 'bg-gray-400'}`}>
                      {ev.event_type || 'Event'}
                    </button>
                  ))}
                  {events.length > 3 && <span className="text-muted-foreground">+{events.length - 3} more</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedEvent?.event_type || 'Event Details'}</DialogTitle></DialogHeader>
          {selectedEvent && (
            <div className="space-y-2 text-sm">
              <p><strong>Customer:</strong> {selectedEvent.customer_name || 'N/A'}</p>
              <p><strong>Date:</strong> {selectedEvent.event_date}</p>
              <p><strong>Guests:</strong> {selectedEvent.guest_count || 'N/A'}</p>
              <p><strong>Budget:</strong> ${selectedEvent.budget || selectedEvent.total_price || 0}</p>
              <p><strong>Status:</strong> <Badge className={`${STATUS_COLORS[selectedEvent.status] || ''} text-white`}>{selectedEvent.status}</Badge></p>
              <p><strong>Location:</strong> {selectedEvent.city}, {selectedEvent.state}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
