import { supabase } from '@/integrations/supabase/client';

export interface AdvisorTrigger {
  id: string;
  trigger_name: string;
  trigger_type: 'risk' | 'opportunity' | 'task' | 'action';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  condition_detected: string;
  details: Record<string, any>;
  recommended_action: string | null;
  auto_generated_task: boolean;
  status: 'open' | 'processing' | 'resolved' | 'dismissed';
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AutopilotSettings {
  id: string;
  user_id: string | null;
  autopilot_enabled: boolean;
  auto_create_tasks: boolean;
  auto_assign_routes: boolean;
  auto_send_communications: boolean;
  auto_financial_corrections: boolean;
  severity_threshold: 'low' | 'medium' | 'high' | 'critical';
}

export interface InstinctStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  resolved_today: number;
}

// Run the instinct scan manually
export async function runInstinctScan(): Promise<{ success: boolean; triggers_detected?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke('advisor-instincts');
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, triggers_detected: data?.triggers_detected || 0 };
}

// Get all triggers with optional filters
export async function getTriggers(params?: {
  status?: string;
  severity?: string;
  category?: string;
  limit?: number;
}): Promise<AdvisorTrigger[]> {
  let query = supabase
    .from('advisor_triggers')
    .select('*')
    .order('created_at', { ascending: false });

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.severity) {
    query = query.eq('severity', params.severity);
  }
  if (params?.category) {
    query = query.eq('category', params.category);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AdvisorTrigger[];
}

// Get trigger stats
export async function getTriggerStats(): Promise<InstinctStats> {
  const today = new Date().toISOString().split('T')[0];
  
  const [
    { data: allTriggers },
    { data: resolvedToday },
  ] = await Promise.all([
    supabase.from('advisor_triggers').select('severity, status'),
    supabase.from('advisor_triggers').select('id').eq('status', 'resolved').gte('resolved_at', today),
  ]);

  const triggers = allTriggers || [];
  const openTriggers = triggers.filter(t => t.status === 'open');

  return {
    total: triggers.length,
    critical: openTriggers.filter(t => t.severity === 'critical').length,
    high: openTriggers.filter(t => t.severity === 'high').length,
    medium: openTriggers.filter(t => t.severity === 'medium').length,
    low: openTriggers.filter(t => t.severity === 'low').length,
    open: openTriggers.length,
    resolved_today: (resolvedToday || []).length,
  };
}

// Update trigger status
export async function updateTriggerStatus(
  triggerId: string,
  status: 'open' | 'processing' | 'resolved' | 'dismissed'
): Promise<void> {
  const updates: Record<string, any> = { status };
  
  if (status === 'resolved' || status === 'dismissed') {
    updates.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('advisor_triggers')
    .update(updates)
    .eq('id', triggerId);

  if (error) throw error;
}

// Bulk resolve triggers
export async function bulkResolveTriggers(triggerIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('advisor_triggers')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .in('id', triggerIds);

  if (error) throw error;
}

// Get autopilot settings
export async function getAutopilotSettings(): Promise<AutopilotSettings | null> {
  const { data, error } = await supabase
    .from('autopilot_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as AutopilotSettings | null;
}

// Update autopilot settings
export async function updateAutopilotSettings(settings: Partial<AutopilotSettings>): Promise<void> {
  const { data: existing } = await supabase
    .from('autopilot_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('autopilot_settings')
      .update(settings)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('autopilot_settings')
      .insert(settings);
    if (error) throw error;
  }
}

// Calculate health scores
export async function calculateHealthScores(): Promise<{
  financial: number;
  operational: number;
  overall: number;
}> {
  const stats = await getTriggerStats();
  
  // Financial health: penalize based on finance-related triggers
  const financialPenalty = (stats.critical * 25) + (stats.high * 15) + (stats.medium * 5);
  const financialHealth = Math.max(0, 100 - financialPenalty);

  // Operational health: based on all open triggers
  const operationalPenalty = (stats.open * 5);
  const operationalHealth = Math.max(0, 100 - operationalPenalty);

  // Overall: weighted average
  const overall = Math.round((financialHealth * 0.6) + (operationalHealth * 0.4));

  return {
    financial: Math.round(financialHealth),
    operational: Math.round(operationalHealth),
    overall,
  };
}