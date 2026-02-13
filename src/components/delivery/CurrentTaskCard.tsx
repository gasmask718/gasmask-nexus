import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, MapPin, User, Phone, Clock, Navigation } from 'lucide-react';
import { useEffect, useState } from 'react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

interface CurrentTaskCardProps {
  workerId: string;
  workerType: 'biker' | 'driver';
}

export function CurrentTaskCard({ workerId, workerType }: CurrentTaskCardProps) {
  const [eta, setEta] = useState<string | null>(null);

  const col = workerType === 'biker' ? 'biker_id' : 'driver_id';

  const { data: activeTask } = useQuery({
    queryKey: ['active-delivery-task', workerId, workerType],
    queryFn: async () => {
      const { data } = await supabase
        .from('delivery_tasks')
        .select(`
          *,
          store_order:store_orders(id, order_number, total_amount, store_id)
        `)
        .eq(col, workerId)
        .in('status', ['assigned', 'picked_up', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data?.store_order?.store_id) {
        const { data: store } = await supabase.from('store_master').select('id, store_name, address').eq('id', data.store_order.store_id).maybeSingle();
        return { ...data, store_order: { ...data.store_order, store } };
      }
      return data;
    },
    enabled: !!workerId,
    refetchInterval: 30000,
  });

  // Calculate ETA from last known location
  useEffect(() => {
    if (!activeTask?.delivery_lat || !activeTask?.delivery_lng) return;

    const fetchEta = async () => {
      try {
        // Get worker's user_id to find their last location
        const table = workerType === 'biker' ? 'bikers' : 'drivers';
        const { data: worker } = await supabase
          .from(table)
          .select('user_id')
          .eq('id', workerId)
          .maybeSingle();

        if (!worker?.user_id) return;

        const { data: locEvent } = await supabase
          .from('location_events')
          .select('lat, lng')
          .eq('user_id', worker.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!locEvent?.lat || !locEvent?.lng) return;

        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${locEvent.lng},${locEvent.lat};${activeTask.delivery_lng},${activeTask.delivery_lat}?access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes?.[0]) {
          setEta(`${Math.round(data.routes[0].duration / 60)} min`);
        }
      } catch {
        // silently fail
      }
    };
    fetchEta();
  }, [activeTask, workerId, workerType]);

  if (!activeTask) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> Current Task
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active delivery task</p>
        </CardContent>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    assigned: 'bg-amber-500/10 text-amber-600',
    picked_up: 'bg-blue-500/10 text-blue-600',
    in_transit: 'bg-blue-500/10 text-blue-600',
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Current Task</span>
          <Badge variant="outline" className={statusColors[activeTask.status] || ''}>{activeTask.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="font-semibold">
          {activeTask.store_order?.order_number || `ORD-${activeTask.store_order_id?.slice(0,8)}`}
        </div>
        <div className="text-muted-foreground">{(activeTask.store_order as any)?.store?.store_name}</div>
        
        {activeTask.recipient_name && (
          <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" /> {activeTask.recipient_name}</div>
        )}
        {activeTask.recipient_phone && (
          <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {activeTask.recipient_phone}</div>
        )}
        {activeTask.delivery_address && (
          <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {activeTask.delivery_address}</div>
        )}

        {eta && (
          <div className="flex items-center gap-4 pt-2 border-t">
            <div className="flex items-center gap-1.5 text-primary font-medium">
              <Clock className="h-4 w-4" /> ETA: {eta}
            </div>
          </div>
        )}

        {activeTask.store_order?.total_amount && (
          <div className="text-xs text-muted-foreground pt-1">
            Order amount: ${activeTask.store_order.total_amount.toFixed(2)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
