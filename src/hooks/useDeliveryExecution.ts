import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export type DeliveryStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'rescheduled';

export interface Delivery {
  id: string;
  business_id: string;
  delivery_type: string;
  scheduled_date: string;
  priority: string;
  status: string;
  assigned_driver_id: string | null;
  dispatcher_notes: string | null;
  internal_notes: string | null;
  store_id?: string | null;
  route_id?: string | null;
  brand?: string;
  items?: any[];
  total_quantity?: number;
  special_instructions?: string;
  pod_photo_url?: string | null;
  pod_signature_url?: string | null;
  pod_recipient_name?: string | null;
  pod_notes?: string | null;
  pod_captured_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
  store?: {
    id: string;
    name: string;
    address_street?: string;
    address_city?: string;
  };
}

export interface DeliveryException {
  id: string;
  delivery_id: string;
  exception_type: string;
  severity: string;
  description: string;
  photo_urls: string[];
  resolution?: string;
  resolved_at?: string;
  created_at: string;
}

export function useMyRouteToday() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-route-today', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const today = new Date().toISOString().split('T')[0];

      // Get route assigned to current user for today
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('date', today)
        .maybeSingle();

      if (routeError) throw routeError;
      if (!route) return null;

      // Get stops for this route
      const { data: stops, error: stopsError } = await supabase
        .from('route_stops')
        .select(`
          *,
          store:stores(id, name, address_street, address_city, lat, lng, phone)
        `)
        .eq('route_id', route.id)
        .order('planned_order', { ascending: true });

      if (stopsError) throw stopsError;

      // Get deliveries for this route
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('route_id', route.id);

      if (deliveriesError) throw deliveriesError;

      return {
        route,
        stops: stops || [],
        deliveries: deliveries || [],
        stats: {
          totalStops: stops?.length || 0,
          completedStops: stops?.filter(s => s.status === 'completed').length || 0,
          pendingStops: stops?.filter(s => s.status === 'pending').length || 0,
          skippedStops: stops?.filter(s => s.status === 'skipped').length || 0,
        }
      };
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useDeliveryActions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const updateStopStatus = useMutation({
    mutationFn: async ({ stopId, status, notes }: { stopId: string; status: string; notes?: string }) => {
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'completed') {
        updateData.actual_arrival = new Date().toISOString();
      }

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('route_stops')
        .update(updateData)
        .eq('id', stopId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-route-today'] });
      toast.success('Stop updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update stop: ${error.message}`);
    },
  });

  const updateDeliveryStatus = useMutation({
    mutationFn: async ({ deliveryId, status, failureReason }: { 
      deliveryId: string; 
      status: string; 
      failureReason?: string;
    }) => {
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      if (status === 'failed' && failureReason) {
        updateData.failed_at = new Date().toISOString();
        updateData.failure_reason = failureReason;
      }

      const { error } = await supabase
        .from('deliveries')
        .update(updateData)
        .eq('id', deliveryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-route-today'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Delivery updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update delivery: ${error.message}`);
    },
  });

  const capturePOD = useMutation({
    mutationFn: async ({ 
      deliveryId, 
      photoUrl, 
      signatureUrl, 
      recipientName, 
      notes 
    }: {
      deliveryId: string;
      photoUrl?: string;
      signatureUrl?: string;
      recipientName?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('deliveries')
        .update({
          pod_photo_url: photoUrl,
          pod_signature_url: signatureUrl,
          pod_recipient_name: recipientName,
          pod_notes: notes,
          pod_captured_at: new Date().toISOString(),
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', deliveryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-route-today'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Proof of delivery captured');
    },
    onError: (error: Error) => {
      toast.error(`Failed to capture POD: ${error.message}`);
    },
  });

  const reportException = useMutation({
    mutationFn: async ({
      deliveryId,
      exceptionType,
      severity,
      description,
      photoUrls,
    }: {
      deliveryId: string;
      exceptionType: string;
      severity: string;
      description: string;
      photoUrls?: string[];
    }) => {
      const { error } = await supabase
        .from('delivery_exceptions')
        .insert({
          delivery_id: deliveryId,
          exception_type: exceptionType,
          severity,
          description,
          photo_urls: photoUrls || [],
          reported_by: user?.id,
        });

      if (error) throw error;

      // Also update delivery status to failed if critical
      if (severity === 'critical' || severity === 'high') {
        await supabase
          .from('deliveries')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            failure_reason: `Exception: ${exceptionType}`,
          })
          .eq('id', deliveryId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-route-today'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-exceptions'] });
      toast.success('Exception reported');
    },
    onError: (error: Error) => {
      toast.error(`Failed to report exception: ${error.message}`);
    },
  });

  const startRoute = useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase
        .from('routes')
        .update({
          status: 'in_progress',
          route_state: 'active',
        })
        .eq('id', routeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-route-today'] });
      toast.success('Route started');
    },
    onError: (error: Error) => {
      toast.error(`Failed to start route: ${error.message}`);
    },
  });

  const completeRoute = useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase
        .from('routes')
        .update({
          status: 'completed',
          route_state: 'completed',
        })
        .eq('id', routeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-route-today'] });
      toast.success('Route completed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete route: ${error.message}`);
    },
  });

  return {
    updateStopStatus,
    updateDeliveryStatus,
    capturePOD,
    reportException,
    startRoute,
    completeRoute,
  };
}

export function useDeliveryExceptions(deliveryId?: string) {
  return useQuery({
    queryKey: ['delivery-exceptions', deliveryId],
    queryFn: async () => {
      let query = supabase
        .from('delivery_exceptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (deliveryId) {
        query = query.eq('delivery_id', deliveryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DeliveryException[];
    },
  });
}
