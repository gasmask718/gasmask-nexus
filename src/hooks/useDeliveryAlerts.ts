// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY ALERTS & ESCALATION SYSTEM — Floor 4 Phase 3
// Automatic alerts, SLA timers, and escalation ladder
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export type AlertType =
  | 'critical_exception'
  | 'stalled_route'
  | 'repeated_failure'
  | 'sla_warning'
  | 'sla_breach'
  | 'capacity_overload'
  | 'worker_unavailable'
  | 'vehicle_issue'
  | 'customer_escalation';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'expired';

export interface DeliveryAlert {
  id: string;
  route_id: string | null;
  stop_id: string | null;
  delivery_id: string | null;
  exception_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  context: Record<string, any> | null;
  sla_deadline: string | null;
  sla_breached: boolean;
  sla_breached_at: string | null;
  escalation_level: number;
  escalated_at: string | null;
  escalated_to: string | null;
  status: AlertStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch open alerts
export function useOpenAlerts() {
  return useQuery({
    queryKey: ['open-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_alerts')
        .select(`
          *,
          route:routes(id, territory, date, assigned_to),
          escalated_user:profiles!delivery_alerts_escalated_to_fkey(id, name, role)
        `)
        .in('status', ['open', 'acknowledged', 'in_progress'])
        .order('severity', { ascending: true }) // Critical first
        .order('created_at', { ascending: true }); // Oldest first
      
      if (error) throw error;
      return data as (DeliveryAlert & { route: any; escalated_user: any })[];
    },
    refetchInterval: 10000, // Check every 10 seconds
  });
}

// Fetch alerts by severity
export function useAlertsBySeverity(severity: AlertSeverity) {
  return useQuery({
    queryKey: ['alerts-by-severity', severity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_alerts')
        .select('*')
        .eq('severity', severity)
        .in('status', ['open', 'acknowledged'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DeliveryAlert[];
    },
  });
}

// Fetch alerts for a route
export function useRouteAlerts(routeId: string) {
  return useQuery({
    queryKey: ['route-alerts', routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_alerts')
        .select('*')
        .eq('route_id', routeId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DeliveryAlert[];
    },
    enabled: !!routeId,
  });
}

// Alert statistics
export function useAlertStats() {
  return useQuery({
    queryKey: ['alert-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_alerts')
        .select('severity, status, sla_breached')
        .in('status', ['open', 'acknowledged', 'in_progress']);
      
      if (error) throw error;
      
      const stats = {
        total: data.length,
        critical: data.filter(a => a.severity === 'critical').length,
        high: data.filter(a => a.severity === 'high').length,
        medium: data.filter(a => a.severity === 'medium').length,
        low: data.filter(a => a.severity === 'low').length,
        slaBreached: data.filter(a => a.sla_breached).length,
        acknowledged: data.filter(a => a.status === 'acknowledged').length,
        inProgress: data.filter(a => a.status === 'in_progress').length,
      };
      
      return stats;
    },
    refetchInterval: 30000,
  });
}

// Alert management mutations
export function useAlertActions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Create new alert
  const createAlert = useMutation({
    mutationFn: async ({
      alertType,
      severity,
      title,
      description,
      routeId,
      stopId,
      deliveryId,
      exceptionId,
      slaMinutes,
      context,
    }: {
      alertType: AlertType;
      severity: AlertSeverity;
      title: string;
      description?: string;
      routeId?: string;
      stopId?: string;
      deliveryId?: string;
      exceptionId?: string;
      slaMinutes?: number;
      context?: Record<string, any>;
    }) => {
      const slaDeadline = slaMinutes 
        ? new Date(Date.now() + slaMinutes * 60 * 1000).toISOString()
        : null;
      
      const { data, error } = await supabase
        .from('delivery_alerts')
        .insert({
          alert_type: alertType,
          severity,
          title,
          description,
          route_id: routeId,
          stop_id: stopId,
          delivery_id: deliveryId,
          exception_id: exceptionId,
          sla_deadline: slaDeadline,
          context,
          escalation_level: severity === 'critical' ? 2 : 1,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create alert: ${error.message}`);
    },
  });
  
  // Acknowledge alert
  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('delivery_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-alerts'] });
      toast.success('Alert acknowledged');
    },
    onError: (error: Error) => {
      toast.error(`Failed to acknowledge: ${error.message}`);
    },
  });
  
  // Start working on alert
  const startAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('delivery_alerts')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-alerts'] });
      toast.success('Working on alert');
    },
  });
  
  // Resolve alert
  const resolveAlert = useMutation({
    mutationFn: async ({
      alertId,
      resolutionNotes,
    }: {
      alertId: string;
      resolutionNotes: string;
    }) => {
      const { error } = await supabase
        .from('delivery_alerts')
        .update({
          status: 'resolved',
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
      toast.success('Alert resolved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to resolve: ${error.message}`);
    },
  });
  
  // Escalate alert
  const escalateAlert = useMutation({
    mutationFn: async ({
      alertId,
      escalateTo,
      reason,
    }: {
      alertId: string;
      escalateTo: string;
      reason?: string;
    }) => {
      const { data: currentAlert, error: fetchError } = await supabase
        .from('delivery_alerts')
        .select('escalation_level')
        .eq('id', alertId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const newLevel = Math.min((currentAlert.escalation_level || 1) + 1, 3);
      
      const { error } = await supabase
        .from('delivery_alerts')
        .update({
          escalation_level: newLevel,
          escalated_at: new Date().toISOString(),
          escalated_to: escalateTo,
          description: reason ? `Escalated: ${reason}` : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-alerts'] });
      toast.success('Alert escalated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to escalate: ${error.message}`);
    },
  });
  
  // Check and breach SLAs
  const checkSLABreaches = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      
      const { data: breachedAlerts, error: fetchError } = await supabase
        .from('delivery_alerts')
        .select('id')
        .lt('sla_deadline', now)
        .eq('sla_breached', false)
        .in('status', ['open', 'acknowledged', 'in_progress']);
      
      if (fetchError) throw fetchError;
      
      if (breachedAlerts && breachedAlerts.length > 0) {
        const ids = breachedAlerts.map(a => a.id);
        
        const { error: updateError } = await supabase
          .from('delivery_alerts')
          .update({
            sla_breached: true,
            sla_breached_at: now,
            severity: 'critical', // Auto-escalate severity
            updated_at: now,
          })
          .in('id', ids);
        
        if (updateError) throw updateError;
        
        return breachedAlerts.length;
      }
      
      return 0;
    },
    onSuccess: (count) => {
      if (count > 0) {
        queryClient.invalidateQueries({ queryKey: ['open-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
        toast.error(`${count} alert(s) breached SLA!`);
      }
    },
  });
  
  return {
    createAlert,
    acknowledgeAlert,
    startAlert,
    resolveAlert,
    escalateAlert,
    checkSLABreaches,
  };
}

// Auto-generate alerts from exceptions
export function useAutoAlertGeneration() {
  const { createAlert } = useAlertActions();
  
  const generateFromException = async (exception: {
    id: string;
    delivery_id: string;
    exception_type: string;
    severity: string;
    description: string;
  }) => {
    const severityMap: Record<string, AlertSeverity> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };
    
    const slaMap: Record<string, number> = {
      critical: 15, // 15 minutes
      high: 30,
      medium: 60,
      low: 120,
    };
    
    await createAlert.mutateAsync({
      alertType: 'critical_exception',
      severity: severityMap[exception.severity] || 'medium',
      title: `Exception: ${exception.exception_type.replace(/_/g, ' ')}`,
      description: exception.description,
      deliveryId: exception.delivery_id,
      exceptionId: exception.id,
      slaMinutes: slaMap[exception.severity] || 60,
      context: { exception_type: exception.exception_type },
    });
  };
  
  return { generateFromException };
}
