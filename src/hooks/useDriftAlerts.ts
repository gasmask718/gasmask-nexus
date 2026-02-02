// Floor 9 - Drift Alerts Hooks (Phase 9.1)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  getDriftAlerts,
  acknowledgeDriftAlert,
  getConfidenceDriftMetrics,
  calculateAndPersistDriftAlerts,
  checkKillSwitchStatus,
  DriftAlert,
  ConfidenceDriftMetrics,
} from '@/services/floor9/driftAlerts';

// Get all drift alerts
export function useDriftAlerts(params?: {
  status?: 'open' | 'acknowledged' | 'resolved';
  severity?: 'warning' | 'critical';
  limit?: number;
}) {
  return useQuery({
    queryKey: ['floor9', 'drift-alerts', params],
    queryFn: () => getDriftAlerts(params),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Get open drift alerts count (for badges/indicators)
export function useOpenDriftAlertsCount() {
  const { data } = useDriftAlerts({ status: 'open' });
  return data?.length || 0;
}

// Acknowledge a drift alert
export function useAcknowledgeDriftAlert() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ alertId, userId }: { alertId: string; userId?: string }) =>
      acknowledgeDriftAlert(alertId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'drift-alerts'] });
      toast({ title: 'Alert acknowledged', description: 'Drift alert has been acknowledged' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to acknowledge alert',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Get real confidence drift metrics from database
export function useConfidenceDriftMetrics() {
  return useQuery({
    queryKey: ['floor9', 'drift-metrics'],
    queryFn: getConfidenceDriftMetrics,
    refetchInterval: 60000, // Refresh every minute
  });
}

// Check kill switch status
export function useKillSwitchStatus() {
  return useQuery({
    queryKey: ['floor9', 'kill-switch-status'],
    queryFn: checkKillSwitchStatus,
    refetchInterval: 10000, // Check every 10 seconds
  });
}

// Calculate and persist drift alerts
export function useCalculateDriftAlerts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calculateAndPersistDriftAlerts,
    onSuccess: (alertCount) => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'drift-alerts'] });
      if (alertCount > 0) {
        toast({
          title: 'Drift alerts detected',
          description: `${alertCount} new drift alert(s) created`,
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to calculate drift',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Transform metrics for chart display
export function useChartReadyDriftData() {
  const { data: metrics, isLoading } = useConfidenceDriftMetrics();
  const { data: alerts } = useDriftAlerts({ status: 'open' });

  const chartData = (metrics || []).map((m: ConfidenceDriftMetrics) => ({
    date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    confidence: m.avg_confidence,
    acceptanceRate: m.acceptance_rate,
    rejectionRate: m.rejection_rate,
    totalDecisions: m.total_decisions,
  }));

  const formattedAlerts = (alerts || []).map((a: DriftAlert) => ({
    id: a.id,
    type: a.alert_type,
    severity: a.severity,
    message: a.message,
    confidence: a.confidence_at_alert || 0,
    humanRate: a.human_rate_at_alert || 0,
    createdAt: a.created_at,
    status: a.status,
  }));

  return {
    chartData,
    alerts: formattedAlerts,
    isLoading,
    hasRealData: chartData.length > 0 && chartData.some(d => d.totalDecisions > 0),
  };
}
