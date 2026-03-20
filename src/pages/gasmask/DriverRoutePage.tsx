import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, CheckCircle2, Navigation, Phone, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function DriverRoutePage() {
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: stops = [] } = useQuery({
    queryKey: ['driver-route-today'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('gasmask_visit_triggers')
        .select('*')
        .eq('scheduled_for', today)
        .in('status', ['scheduled', 'in_route', 'completed'])
        .order('route_position', { ascending: true });
      return data || [];
    },
    refetchInterval: 10000,
  });

  const completedCount = stops.filter((s: any) => s.status === 'completed').length;
  const totalCount = stops.length;
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  const completeStop = async (id: string) => {
    setCompleting(id);
    try {
      await (supabase as any).from('gasmask_visit_triggers').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_notes: notes[id] || null,
      }).eq('id', id);

      // Update route run completed count
      const stop = stops.find((s: any) => s.id === id);
      if (stop?.route_id) {
        const newCompleted = stops.filter((s: any) => s.status === 'completed' || s.id === id).length;
        await (supabase as any).from('gasmask_route_runs').update({ completed_stops: newCompleted }).eq('id', stop.route_id);
      }

      toast.success('Stop completed!');
      queryClient.invalidateQueries({ queryKey: ['driver-route-today'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {/* Progress Header */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold">Today's Route</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMM d')}</p>
        <div className="text-3xl font-bold">{completedCount}/{totalCount} stops</div>
        <div className="w-full h-3 bg-muted rounded-full">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">{pct}% complete</p>
      </div>

      {/* Stops */}
      <div className="space-y-3">
        {stops.map((stop: any, idx: number) => {
          const done = stop.status === 'completed';
          return (
            <Card key={stop.id} className={`transition-all ${done ? 'opacity-60 border-emerald-500/30' : 'border-primary/20'}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${done ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                    {done ? <CheckCircle2 className="h-5 w-5" /> : stop.route_position || idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base">{stop.store_name}</h3>
                    {stop.store_address && <p className="text-sm text-muted-foreground">{stop.store_address}</p>}
                    <p className="text-xs text-muted-foreground">{[stop.store_city, stop.store_state].filter(Boolean).join(', ')}</p>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">{stop.trigger_type?.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className={`text-xs ${stop.urgency === 'critical' ? 'text-red-500 border-red-500/30' : stop.urgency === 'high' ? 'text-amber-500 border-amber-500/30' : ''}`}>
                    {stop.urgency}
                  </Badge>
                </div>

                {stop.trigger_notes && <p className="text-sm bg-muted/50 rounded p-2">{stop.trigger_notes}</p>}
                {stop.ai_recommendation && <p className="text-sm bg-primary/5 rounded p-2">🤖 {stop.ai_recommendation}</p>}

                {!done && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {stop.store_address && (
                        <Button variant="outline" size="sm" className="flex-1 gap-1" asChild>
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.store_address + ' ' + (stop.store_city || ''))}`} target="_blank" rel="noopener noreferrer">
                            <Navigation className="h-3.5 w-3.5" />Navigate
                          </a>
                        </Button>
                      )}
                      {stop.store_phone && (
                        <Button variant="outline" size="sm" className="gap-1" asChild>
                          <a href={`tel:${stop.store_phone}`}><Phone className="h-3.5 w-3.5" /></a>
                        </Button>
                      )}
                    </div>
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[40px]"
                      placeholder="Completion notes..."
                      value={notes[stop.id] || ''}
                      onChange={e => setNotes(n => ({ ...n, [stop.id]: e.target.value }))}
                    />
                    <Button className="w-full gap-2 h-12 text-base" onClick={() => completeStop(stop.id)} disabled={completing === stop.id}>
                      {completing === stop.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                      Mark Complete
                    </Button>
                  </div>
                )}
                {done && stop.completion_notes && (
                  <p className="text-xs text-emerald-600">✅ {stop.completion_notes}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!stops.length && (
          <div className="text-center py-12 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No stops scheduled today</p>
            <p className="text-sm">Routes will appear here when assigned.</p>
          </div>
        )}
      </div>
    </div>
  );
}
