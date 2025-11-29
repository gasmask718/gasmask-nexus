import { supabase } from '@/integrations/supabase/client';

// Types
export interface BusinessTransaction {
  id?: string;
  transaction_date: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  category: string;
  subcategory?: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  brand?: string;
  region?: string;
  tags?: string[];
  receipt_url?: string;
}

export interface PersonalTransaction {
  id?: string;
  user_id: string;
  transaction_date: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  category: string;
  subcategory?: string;
  merchant?: string;
  description?: string;
  payment_method?: string;
  is_recurring?: boolean;
  tags?: string[];
  receipt_url?: string;
  ai_categorized?: boolean;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  revenueByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
  topExpenses: Array<{ category: string; amount: number }>;
  period: string;
}

export interface PersonalSpendingSummary {
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  spendingByCategory: Record<string, number>;
  topMerchants: Array<{ merchant: string; amount: number }>;
  dailyAverage: number;
  comparedToLastPeriod: number;
}

// Business Finance Functions
export async function addBusinessTransaction(transaction: BusinessTransaction) {
  const { data, error } = await supabase
    .from('business_transactions')
    .insert(transaction)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getBusinessTransactions(startDate: string, endDate: string, category?: string) {
  let query = supabase
    .from('business_transactions')
    .select('*')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: false });
  
  if (category) {
    query = query.eq('category', category);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getBusinessSummary(startDate: string, endDate: string): Promise<FinancialSummary> {
  const transactions = await getBusinessTransactions(startDate, endDate);
  
  const income = transactions.filter(t => t.transaction_type === 'income');
  const expenses = transactions.filter(t => t.transaction_type === 'expense');
  
  const totalRevenue = income.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  const revenueByCategory: Record<string, number> = {};
  income.forEach(t => {
    revenueByCategory[t.category] = (revenueByCategory[t.category] || 0) + Number(t.amount);
  });
  
  const expensesByCategory: Record<string, number> = {};
  expenses.forEach(t => {
    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + Number(t.amount);
  });
  
  const topExpenses = Object.entries(expensesByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  
  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin,
    revenueByCategory,
    expensesByCategory,
    topExpenses,
    period: `${startDate} to ${endDate}`,
  };
}

// Personal Finance Functions
export async function addPersonalTransaction(transaction: PersonalTransaction) {
  const { data, error } = await supabase
    .from('personal_transactions')
    .insert(transaction)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getPersonalTransactions(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('personal_transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getPersonalSpendingSummary(userId: string, startDate: string, endDate: string): Promise<PersonalSpendingSummary> {
  const transactions = await getPersonalTransactions(userId, startDate, endDate);
  
  const expenses = transactions.filter(t => t.transaction_type === 'expense');
  const income = transactions.filter(t => t.transaction_type === 'income');
  
  const totalSpent = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalIncome = income.reduce((sum, t) => sum + Number(t.amount), 0);
  
  const spendingByCategory: Record<string, number> = {};
  expenses.forEach(t => {
    spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + Number(t.amount);
  });
  
  const merchantTotals: Record<string, number> = {};
  expenses.forEach(t => {
    if (t.merchant) {
      merchantTotals[t.merchant] = (merchantTotals[t.merchant] || 0) + Number(t.amount);
    }
  });
  
  const topMerchants = Object.entries(merchantTotals)
    .map(([merchant, amount]) => ({ merchant, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  
  const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
  
  return {
    totalSpent,
    totalIncome,
    netSavings: totalIncome - totalSpent,
    spendingByCategory,
    topMerchants,
    dailyAverage: totalSpent / days,
    comparedToLastPeriod: 0, // Would need previous period data
  };
}

// Expense Functions
export async function addBusinessExpense(expense: {
  expense_date: string;
  amount: number;
  category: string;
  vendor?: string;
  description?: string;
  payment_method?: string;
  recurring?: boolean;
  brand?: string;
  department?: string;
}) {
  const { data, error } = await supabase
    .from('business_expenses')
    .insert(expense)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getBusinessExpenses(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('business_expenses')
    .select('*')
    .gte('expense_date', startDate)
    .lte('expense_date', endDate)
    .order('expense_date', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Payroll Functions
export async function getPayrollRecords(status?: string) {
  let query = supabase
    .from('payroll_records')
    .select('*')
    .order('pay_period_end', { ascending: false });
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createPayrollRecord(record: {
  employee_type: string;
  employee_id?: string;
  employee_name: string;
  pay_period_start: string;
  pay_period_end: string;
  hours_worked?: number;
  hourly_rate?: number;
  base_pay: number;
  bonuses?: number;
  commissions?: number;
  deductions?: number;
  net_pay: number;
}) {
  const { data, error } = await supabase
    .from('payroll_records')
    .insert(record)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updatePayrollStatus(id: string, status: string) {
  const updates: Record<string, unknown> = { status };
  if (status === 'paid') {
    updates.paid_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('payroll_records')
    .update(updates)
    .eq('id', id);
  
  if (error) throw error;
}

// Subscription Functions
export async function getSubscriptions(isBusiness?: boolean) {
  let query = supabase
    .from('subscription_expenses')
    .select('*')
    .eq('is_active', true)
    .order('next_billing_date', { ascending: true });
  
  if (isBusiness !== undefined) {
    query = query.eq('is_business', isBusiness);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function addSubscription(subscription: {
  service_name: string;
  category: string;
  amount: number;
  billing_cycle?: string;
  next_billing_date?: string;
  is_business?: boolean;
}) {
  const { data, error } = await supabase
    .from('subscription_expenses')
    .insert(subscription)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Financial Insights
export async function getFinancialInsights(status?: string) {
  let query = supabase
    .from('financial_ai_insights')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createFinancialInsight(insight: {
  insight_type: string;
  insight_category: string;
  title: string;
  description: string;
  severity?: string;
  recommendations?: string[];
  is_business?: boolean;
  user_id?: string;
}) {
  const { data, error } = await supabase
    .from('financial_ai_insights')
    .insert([insight])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Budget Functions
export async function getBudgetProfiles(profileType?: string) {
  let query = supabase
    .from('budget_profiles')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (profileType) {
    query = query.eq('profile_type', profileType);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createBudgetProfile(budget: {
  profile_name: string;
  profile_type: 'business' | 'personal' | 'department' | 'project';
  total_budget: number;
  category_budgets?: Record<string, number>;
  start_date: string;
  end_date?: string;
  user_id?: string;
}) {
  const { data, error } = await supabase
    .from('budget_profiles')
    .insert(budget)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Net Worth Functions
export async function getNetWorthSnapshots(userId: string, limit = 12) {
  const { data, error } = await supabase
    .from('networth_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function createNetWorthSnapshot(snapshot: {
  user_id: string;
  total_assets: number;
  total_liabilities: number;
  assets_breakdown?: Record<string, number>;
  liabilities_breakdown?: Record<string, number>;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from('networth_snapshots')
    .insert(snapshot)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Forecasting
export async function getFinancialForecasts(forecastType?: string) {
  let query = supabase
    .from('financial_forecasts')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (forecastType) {
    query = query.eq('forecast_type', forecastType);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Dashboard Stats
export async function getFinancialDashboardStats() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [businessSummary, subscriptions, payroll, insights] = await Promise.all([
    getBusinessSummary(startOfMonth, endOfMonth),
    getSubscriptions(true),
    getPayrollRecords('pending'),
    getFinancialInsights('active'),
  ]);
  
  const monthlySubscriptionCost = subscriptions.reduce((sum, s) => {
    const amount = Number(s.amount);
    switch (s.billing_cycle) {
      case 'weekly': return sum + (amount * 4);
      case 'yearly': return sum + (amount / 12);
      case 'quarterly': return sum + (amount / 3);
      default: return sum + amount;
    }
  }, 0);
  
  const pendingPayroll = payroll.reduce((sum, p) => sum + Number(p.net_pay), 0);
  
  return {
    businessSummary,
    monthlySubscriptionCost,
    pendingPayroll,
    activeInsights: insights.length,
    criticalInsights: insights.filter(i => i.severity === 'critical').length,
  };
}
