/**
 * NextStopNavigator — resolves the next destination for a driver or ambassador
 * and renders the LiveNavigationMap with live traffic + ETA.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import LiveNavigationMap, { NavDestination } from './LiveNavigationMap';

interface Props {
  role: 'driver' | 'ambassador';
  height?: number;
}

export const NextStopNavigator: React.FC<Props> = ({ role, height = 380 }) => {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Driver: next pending delivery stop today
  const driverQuery = useQuery({
    queryKey: ['driver-next-stop', user?.id, today],
    enabled: role === 'driver' && !!user?.id,
    queryFn: async () => {
      const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select('id, delivery_stops(id, stop_order, status, location_id, locations(name, address_line1, city, lat, lng))')
        .eq('assigned_driver_id', user!.id)
        .eq('scheduled_date', today)
        .in('status', ['scheduled', 'in_progress'])
        .order('created_at', { ascending: true });
      if (error) throw error;

      for (const d of deliveries || []) {
        const stops = ((d as any).delivery_stops || []) as any[];
        const pending = stops
          .filter((s) => s.status !== 'completed' && s.locations?.lat != null && s.locations?.lng != null)
          .sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
        const next = pending[0];
        if (next) {
          return {
            lat: Number(next.locations.lat),
            lng: Number(next.locations.lng),
            label: next.locations.name || next.locations.address_line1 || 'Next Stop',
          } as NavDestination;
        }
      }
      return null;
    },
  });

  // Ambassador: next assigned store (first with coords)
  const ambassadorQuery = useQuery({
    queryKey: ['ambassador-next-store', user?.id],
    enabled: role === 'ambassador' && !!user?.id,
    queryFn: async () => {
      // Resolve the ambassador row for this auth user
      const { data: amb, error: ambErr } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (ambErr) throw ambErr;
      if (!amb?.id) return null;

      const { data: assignments, error } = await supabase
        .from('ambassador_assignments')
        .select('store_id')
        .eq('ambassador_id', amb.id)
        .eq('active', true)
        .not('store_id', 'is', null)
        .limit(50);
      if (error) throw error;

      const ids = (assignments || [])
        .map((a: { store_id: string | null }) => a.store_id)
        .filter((v): v is string => !!v);
      if (!ids.length) return null;

      const { data: coords, error: cErr } = await supabase
        .from('stores')
        .select('id, name, lat, lng')
        .in('id', ids)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(1);
      if (cErr) throw cErr;

      const s = coords?.[0] as { name: string | null; lat: number | string; lng: number | string } | undefined;
      if (!s) return null;
      return {
        lat: Number(s.lat),
        lng: Number(s.lng),
        label: s.name || 'Next Store Visit',
      } as NavDestination;
    },
  });

  const destination = role === 'driver' ? driverQuery.data ?? null : ambassadorQuery.data ?? null;

  const title = useMemo(
    () => (role === 'driver' ? 'Next Delivery' : 'Next Store Visit'),
    [role]
  );

  return <LiveNavigationMap destination={destination} title={title} height={height} />;
};

export default NextStopNavigator;
