// Floor 9 - Drift Alerts Service (Phase 9.1)
import { supabase } from '@/integrations/supabase/client';

export interface DriftAlert {
  id: string;
  alert_type: 'overconfident' | 'underconfident' | 'rejection_spike' | 'acceptance_spike';
  severity: 'warning' | 'critical';
  message: string;
  confidence_at_alert: number | null;
  human_rate_at_alert: number | null;
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  metadata: Record<string, any>;
}

export interface ConfidenceDriftMetrics {
  date: string;
  avg_confidence: number;
  acceptance_rate: number;
  rejection_rate: number;
  total_decisions: number;
}

// Get all drift alerts
export async function getDriftAlerts(params?: {
  status?: 'open' | 'acknowledged' | 'resolved';
  severity?: 'warning' | 'critical';
  limit?: number;
}): Promise<DriftAlert[]> {
  let query = supabase
    .from('ai_drift_alerts')
    .select('*')
    .order('created_at', { ascending: false });

  if (params?.status) query = query.eq('status', params.status);
  if (params?.severity) query = query.eq('severity', params.severity);
  if (params?.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DriftAlert[];
}

// Acknowledge a drift alert (human action required)
export async function acknowledgeDriftAlert(alertId: string, userId?: string): Promise<void> {
  const { error } = await supabase.rpc('acknowledge_drift_alert', {
    p_alert_id: alertId,
    p_user_id: userId || null,
  });

  if (error) throw error;
}

// Get real confidence drift metrics from the database view
export async function getConfidenceDriftMetrics(): Promise<ConfidenceDriftMetrics[]> {
  const { data, error } = await supabase
    .from('v_confidence_drift_metrics')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching drift metrics:', error);
    // Return empty array if view doesn't exist yet
    return [];
  }
  
  return (data || []).map(row => ({
    date: row.date,
    avg_confidence: Number(row.avg_confidence) || 0,
    acceptance_rate: Number(row.acceptance_rate) || 0,
    rejection_rate: Number(row.rejection_rate) || 0,
    total_decisions: Number(row.total_decisions) || 0,
  }));
}

// Calculate and persist drift alerts (called periodically)
export async function calculateAndPersistDriftAlerts(): Promise<number> {
  const { data, error } = await supabase.rpc('calculate_and_persist_drift_alerts');
  
  if (error) {
    console.error('Error calculating drift alerts:', error);
    return 0;
  }
  
  return data || 0;
}

// Create AI action with kill switch enforcement
export async function createAIActionWithKillSwitchCheck(params: {
  actionType: string;
  actionSummary: string;
  aiRecommendation: string;
  reasoning?: Record<string, any>;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore?: number;
  workerId?: string;
  taskId?: string;
  slaDeadline?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_ai_action_with_kill_switch_check', {
    p_action_type: params.actionType,
    p_action_summary: params.actionSummary,
    p_ai_recommendation: params.aiRecommendation,
    p_reasoning: params.reasoning || {},
    p_risk_level: params.riskLevel || 'low',
    p_confidence_score: params.confidenceScore || null,
    p_worker_id: params.workerId || null,
    p_task_id: params.taskId || null,
    p_sla_deadline: params.slaDeadline || null,
  });

  if (error) {
    // Check if it's a kill switch error
    if (error.message.includes('KILL_SWITCH_ACTIVE')) {
      throw new Error(error.message);
    }
    throw error;
  }

  return data as string;
}

// Check if any kill switches are active
export async function checkKillSwitchStatus(): Promise<{
  globalActive: boolean;
  workerKills: string[];
  playbookKills: string[];
}> {
  const { data, error } = await supabase
    .from('ai_kill_switch_state')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;

  const switches = data || [];
  
  return {
    globalActive: switches.some(s => s.scope === 'global'),
    workerKills: switches.filter(s => s.scope === 'worker').map(s => s.target_worker_id).filter(Boolean) as string[],
    playbookKills: switches.filter(s => s.scope === 'playbook').map(s => s.target_playbook_id).filter(Boolean) as string[],
  };
}
