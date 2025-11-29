import { supabase } from '@/integrations/supabase/client';
import { getFinancialDashboardStats } from './financialEngine';

export interface AdvisorAdviceResponse {
  summary: string;
  top_actions: string[];
  warnings: string[];
  opportunities: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
}

export interface ScenarioInputs {
  cut_subscription_percent?: number;
  increase_marketing?: number;
  change_driver_pay_percent?: number;
  raise_price_percent?: number;
  reduce_inventory_percent?: number;
}

export interface ScenarioResult {
  scenario_name: string;
  baseline_metrics: {
    monthly_revenue: number;
    monthly_expenses: number;
    net_profit: number;
    profit_margin: number;
  };
  projected_metrics: {
    monthly_revenue: number;
    monthly_expenses: number;
    net_profit: number;
    profit_margin: number;
  };
  ai_analysis: string;
  ai_recommendations: string[];
  is_favorable: boolean;
  risk_rating: string;
}

export interface UnifiedContext {
  risks: {
    total: number;
    critical: number;
    high: number;
  };
  financial: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    pendingPayroll: number;
    monthlySubscriptions: number;
  };
  briefing: {
    lastMorning?: string;
    lastEvening?: string;
  };
  personalSpending24h: number;
  activeInsights: number;
}

// Get unified context summary from all data sources
export async function getUnifiedContextSummary(userId?: string): Promise<UnifiedContext> {
  const [financialStats, risks, briefings, personalTx] = await Promise.all([
    getFinancialDashboardStats().catch(() => null),
    supabase.from('ai_risk_insights').select('risk_level').eq('status', 'open'),
    supabase.from('ai_daily_briefings').select('*').order('created_at', { ascending: false }).limit(2),
    userId 
      ? supabase.from('personal_transactions')
          .select('amount, transaction_type')
          .eq('user_id', userId)
          .gte('transaction_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      : { data: [] },
  ]);

  const riskData = risks.data || [];
  const criticalCount = riskData.filter(r => r.risk_level === 'critical').length;
  const highCount = riskData.filter(r => r.risk_level === 'high').length;

  const personalSpending = (personalTx.data || [])
    .filter(t => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    risks: {
      total: riskData.length,
      critical: criticalCount,
      high: highCount,
    },
    financial: {
      totalRevenue: financialStats?.businessSummary?.totalRevenue || 0,
      totalExpenses: financialStats?.businessSummary?.totalExpenses || 0,
      netProfit: financialStats?.businessSummary?.netProfit || 0,
      profitMargin: financialStats?.businessSummary?.profitMargin || 0,
      pendingPayroll: financialStats?.pendingPayroll || 0,
      monthlySubscriptions: financialStats?.monthlySubscriptionCost || 0,
    },
    briefing: {
      lastMorning: (briefings.data || []).find(b => b.briefing_type === 'morning')?.ai_summary,
      lastEvening: (briefings.data || []).find(b => b.briefing_type === 'evening')?.ai_summary,
    },
    personalSpending24h: personalSpending,
    activeInsights: financialStats?.activeInsights || 0,
  };
}

// Request advice from the advisor mind
export async function requestAdvisorAdvice(params: {
  userId?: string;
  question?: string;
  mode?: 'business' | 'personal' | 'mixed';
  timeWindow?: string;
}): Promise<{ success: boolean; advice?: AdvisorAdviceResponse; error?: string }> {
  const { data, error } = await supabase.functions.invoke('advisor-mind', {
    body: {
      mode: 'advice',
      userId: params.userId,
      question: params.question,
      advisorMode: params.mode || 'mixed',
      timeWindow: params.timeWindow || 'today',
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, advice: data?.advice };
}

// Run a "what if" scenario simulation
export async function runScenarioSimulation(params: {
  userId?: string;
  scenarioName: string;
  inputs: ScenarioInputs;
}): Promise<{ success: boolean; scenario?: ScenarioResult; error?: string }> {
  const { data, error } = await supabase.functions.invoke('advisor-mind', {
    body: {
      mode: 'simulation',
      userId: params.userId,
      scenarioName: params.scenarioName,
      scenarioInputs: params.inputs,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, scenario: data?.scenario };
}

// Get recent advisor sessions
export async function getAdvisorSessions(limit = 20) {
  const { data, error } = await supabase
    .from('advisor_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Get recent scenarios
export async function getAdvisorScenarios(limit = 20) {
  const { data, error } = await supabase
    .from('advisor_scenarios')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Get advisor action log
export async function getAdvisorActions(status?: string) {
  let query = supabase
    .from('advisor_action_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Update action status
export async function updateActionStatus(actionId: string, status: string) {
  const { error } = await supabase
    .from('advisor_action_log')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', actionId);

  if (error) throw error;
}

// Get latest advisor summary for dashboard
export async function getLatestAdvisorSummary() {
  const { data, error } = await supabase
    .from('advisor_sessions')
    .select('*')
    .eq('session_type', 'advice')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}
