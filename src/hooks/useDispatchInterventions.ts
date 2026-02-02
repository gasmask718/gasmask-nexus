// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCH INTERVENTION CONTROLS — Floor 4 Phase 3
// Real-time ops interventions with full audit trail
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export type InterventionType =
  | 'reassign_route'
  | 'reassign_stop'
  | 'split_route'
  | 'merge_route'
  | 'pause_route'
  | 'resume_route'
  | 'cancel_route'
  | 'force_complete'
  | 'force_cancel'
  | 'add_emergency_stop'
  | 'override_capacity'
  | 'escalate';

export interface DispatchIntervention {
  id: string;
  route_id: string | null;
  stop_id: string | null;
  delivery_id: string | null;
  intervention_type: InterventionType;
  reason: string;
  justification: string | null;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  performed_by: string;
  original_assignee: string | null;
  new_assignee: string | null;
  escalation_level: number;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

// Fetch interventions for a route
export function useRouteInterventions(routeId: string) {
  return useQuery({
    queryKey: ['route-interventions', routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispatch_interventions')
        .select(`
          *,
          performer:profiles!dispatch_interventions_performed_by_fkey(id, name, role),
          approver:profiles!dispatch_interventions_approved_by_fkey(id, name, role)
        `)
        .eq('route_id', routeId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (DispatchIntervention & { performer: any; approver: any })[];
    },
    enabled: !!routeId,
  });
}

// Fetch recent interventions (for ops dashboard)
export function useRecentInterventions(limit = 20) {
  return useQuery({
    queryKey: ['recent-interventions', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispatch_interventions')
        .select(`
          *,
          performer:profiles!dispatch_interventions_performed_by_fkey(id, name, role),
          route:routes(id, territory, date)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data;
    },
  });
}

// Create intervention mutations
export function useDispatchActions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Reassign entire route to different worker
  const reassignRoute = useMutation({
    mutationFn: async ({ 
      routeId, 
      newAssigneeId, 
      reason 
    }: { 
      routeId: string; 
      newAssigneeId: string; 
      reason: string;
    }) => {
      // Get current route state
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();
      
      if (routeError) throw routeError;
      
      const beforeState = { assigned_to: route.assigned_to, status: route.status };
      
      // Update route assignment
      const { error: updateError } = await supabase
        .from('routes')
        .update({ assigned_to: newAssigneeId })
        .eq('id', routeId);
      
      if (updateError) throw updateError;
      
      // Log intervention
      const { error: logError } = await supabase
        .from('dispatch_interventions')
        .insert({
          route_id: routeId,
          intervention_type: 'reassign_route',
          reason,
          before_state: beforeState,
          after_state: { assigned_to: newAssigneeId, status: route.status },
          performed_by: user?.id,
          original_assignee: route.assigned_to,
          new_assignee: newAssigneeId,
        });
      
      if (logError) throw logError;
    },
    onSuccess: (_, { routeId }) => {
      queryClient.invalidateQueries({ queryKey: ['active-routes-ops'] });
      queryClient.invalidateQueries({ queryKey: ['route-interventions', routeId] });
      toast.success('Route reassigned');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reassign route: ${error.message}`);
    },
  });
  
  // Reassign individual stop
  const reassignStop = useMutation({
    mutationFn: async ({
      stopId,
      newRouteId,
      reason,
    }: {
      stopId: string;
      newRouteId: string;
      reason: string;
    }) => {
      const { data: stop, error: stopError } = await supabase
        .from('route_stops')
        .select('*')
        .eq('id', stopId)
        .single();
      
      if (stopError) throw stopError;
      
      const beforeState = { route_id: stop.route_id, planned_order: stop.planned_order };
      
      // Get max order in new route
      const { data: maxOrder } = await supabase
        .from('route_stops')
        .select('planned_order')
        .eq('route_id', newRouteId)
        .order('planned_order', { ascending: false })
        .limit(1)
        .single();
      
      const newOrder = (maxOrder?.planned_order || 0) + 1;
      
      const { error: updateError } = await supabase
        .from('route_stops')
        .update({ route_id: newRouteId, planned_order: newOrder })
        .eq('id', stopId);
      
      if (updateError) throw updateError;
      
      await supabase
        .from('dispatch_interventions')
        .insert({
          stop_id: stopId,
          route_id: stop.route_id,
          intervention_type: 'reassign_stop',
          reason,
          before_state: beforeState,
          after_state: { route_id: newRouteId, planned_order: newOrder },
          performed_by: user?.id,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-routes-ops'] });
      toast.success('Stop reassigned to new route');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reassign stop: ${error.message}`);
    },
  });
  
  // Pause route
  const pauseRoute = useMutation({
    mutationFn: async ({ routeId, reason }: { routeId: string; reason: string }) => {
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('status, route_state')
        .eq('id', routeId)
        .single();
      
      if (routeError) throw routeError;
      
      const { error: updateError } = await supabase
        .from('routes')
        .update({ status: 'paused' })
        .eq('id', routeId);
      
      if (updateError) throw updateError;
      
      await supabase
        .from('dispatch_interventions')
        .insert({
          route_id: routeId,
          intervention_type: 'pause_route',
          reason,
          before_state: { status: route.status },
          after_state: { status: 'paused' },
          performed_by: user?.id,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-routes-ops'] });
      toast.success('Route paused');
    },
    onError: (error: Error) => {
      toast.error(`Failed to pause route: ${error.message}`);
    },
  });
  
  // Resume route
  const resumeRoute = useMutation({
    mutationFn: async ({ routeId, reason }: { routeId: string; reason: string }) => {
      const { error: updateError } = await supabase
        .from('routes')
        .update({ status: 'in_progress' })
        .eq('id', routeId);
      
      if (updateError) throw updateError;
      
      await supabase
        .from('dispatch_interventions')
        .insert({
          route_id: routeId,
          intervention_type: 'resume_route',
          reason,
          before_state: { status: 'paused' },
          after_state: { status: 'in_progress' },
          performed_by: user?.id,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-routes-ops'] });
      toast.success('Route resumed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to resume route: ${error.message}`);
    },
  });
  
  // Cancel route
  const cancelRoute = useMutation({
    mutationFn: async ({ 
      routeId, 
      reason, 
      justification 
    }: { 
      routeId: string; 
      reason: string; 
      justification: string;
    }) => {
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();
      
      if (routeError) throw routeError;
      
      const { error: updateError } = await supabase
        .from('routes')
        .update({ 
          status: 'cancelled', 
          route_state: 'cancelled' 
        })
        .eq('id', routeId);
      
      if (updateError) throw updateError;
      
      await supabase
        .from('dispatch_interventions')
        .insert({
          route_id: routeId,
          intervention_type: 'cancel_route',
          reason,
          justification,
          before_state: { status: route.status, route_state: route.route_state },
          after_state: { status: 'cancelled', route_state: 'cancelled' },
          performed_by: user?.id,
          escalation_level: 1,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-routes-ops'] });
      toast.success('Route cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel route: ${error.message}`);
    },
  });
  
  // Force complete delivery
  const forceCompleteDelivery = useMutation({
    mutationFn: async ({
      deliveryId,
      reason,
      justification,
    }: {
      deliveryId: string;
      reason: string;
      justification: string;
    }) => {
      const { data: delivery, error: deliveryError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('id', deliveryId)
        .single();
      
      if (deliveryError) throw deliveryError;
      
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', deliveryId);
      
      if (updateError) throw updateError;
      
      await supabase
        .from('dispatch_interventions')
        .insert({
          delivery_id: deliveryId,
          intervention_type: 'force_complete',
          reason,
          justification,
          before_state: { status: delivery.status },
          after_state: { status: 'completed' },
          performed_by: user?.id,
          requires_approval: true,
          escalation_level: 2,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Delivery force completed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete delivery: ${error.message}`);
    },
  });
  
  // Add emergency stop
  const addEmergencyStop = useMutation({
    mutationFn: async ({
      routeId,
      storeId,
      reason,
      priority,
    }: {
      routeId: string;
      storeId: string;
      reason: string;
      priority: 'normal' | 'urgent' | 'emergency';
    }) => {
      // Get current max order
      const { data: maxStop } = await supabase
        .from('route_stops')
        .select('planned_order')
        .eq('route_id', routeId)
        .order('planned_order', { ascending: false })
        .limit(1)
        .single();
      
      const newOrder = (maxStop?.planned_order || 0) + 1;
      
      const { data: newStop, error: insertError } = await supabase
        .from('route_stops')
        .insert({
          route_id: routeId,
          store_id: storeId,
          planned_order: newOrder,
          status: 'pending',
          notes_to_worker: `EMERGENCY STOP: ${reason}`,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      await supabase
        .from('dispatch_interventions')
        .insert({
          route_id: routeId,
          stop_id: newStop.id,
          intervention_type: 'add_emergency_stop',
          reason,
          after_state: { store_id: storeId, priority },
          performed_by: user?.id,
        });
      
      return newStop;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-routes-ops'] });
      toast.success('Emergency stop added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add stop: ${error.message}`);
    },
  });
  
  // Override capacity
  const overrideCapacity = useMutation({
    mutationFn: async ({
      routeId,
      reason,
      justification,
      newCapacity,
    }: {
      routeId: string;
      reason: string;
      justification: string;
      newCapacity: number;
    }) => {
      await supabase
        .from('dispatch_interventions')
        .insert({
          route_id: routeId,
          intervention_type: 'override_capacity',
          reason,
          justification,
          after_state: { capacity_override: newCapacity },
          performed_by: user?.id,
          requires_approval: true,
          escalation_level: 2,
        });
    },
    onSuccess: () => {
      toast.success('Capacity override logged');
    },
    onError: (error: Error) => {
      toast.error(`Failed to log override: ${error.message}`);
    },
  });
  
  return {
    reassignRoute,
    reassignStop,
    pauseRoute,
    resumeRoute,
    cancelRoute,
    forceCompleteDelivery,
    addEmergencyStop,
    overrideCapacity,
  };
}
