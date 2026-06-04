import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Types for report data
export interface AmbassadorFinancialSummary {
  ambassador_id: string;
  ambassador_name: string | null;
  user_id: string | null;
  commission_count: number;
  lifetime_earned: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
  override_total: number;
  first_earned_at: string | null;
  last_earned_at: string | null;
}

export interface FinancialPeriodSummary {
  period_month: string;
  gross_revenue: number;
  total_commissions: number;
  total_overrides: number;
  total_paid: number;
  outstanding_liability: number;
  active_ambassadors: number;
  active_stores: number;
}

export interface StorePerformance {
  store_id: string;
  store_name: string;
  city: string | null;
  state: string | null;
  commission_count: number;
  store_revenue: number;
  commissions_generated: number;
  ambassadors_involved: number;
  last_activity: string | null;
}

export interface PayoutLiability {
  currency: string;
  liability_amount: number;
  pending_items: number;
}

export interface Ambassador1099Summary {
  ambassador_id: string;
  ambassador_name: string | null;
  user_id: string | null;
  tax_year: number;
  total_paid: number;
  payment_count: number;
}

export interface PayoutBatchSummary {
  batch_id: string;
  ambassador_id: string | null;
  ambassador_name: string | null;
  period_start: string;
  period_end: string;
  status: string;
  currency: string;
  subtotal_amount: number;
  adjustments_amount: number;
  total_amount: number;
  paid_at: string | null;
  created_at: string;
}

export interface AmbassadorMonthlyEarnings {
  ambassador_id: string;
  month: string;
  total_earned: number;
  override_earned: number;
  direct_earned: number;
  paid_amount: number;
  pending_amount: number;
}

// Ambassador Financial Summary (all ambassadors)
export function useAmbassadorFinancialSummary() {
  return useQuery({
    queryKey: ['report-ambassador-financial-summary'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_ambassador_financial_summary')
        .select('*')
        .order('lifetime_earned', { ascending: false });
      
      if (error) throw error;
      return data as AmbassadorFinancialSummary[];
    },
  });
}

// Financial Period Summary (month-by-month)
export function useFinancialPeriodSummary() {
  return useQuery({
    queryKey: ['report-financial-period-summary'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_financial_period_summary')
        .select('*')
        .order('period_month', { ascending: false })
        .limit(24); // Last 2 years
      
      if (error) throw error;
      return data as FinancialPeriodSummary[];
    },
  });
}

// Store Commission Performance
export function useStorePerformance() {
  return useQuery({
    queryKey: ['report-store-performance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_store_commission_performance')
        .select('*')
        .order('commissions_generated', { ascending: false });
      
      if (error) throw error;
      return data as StorePerformance[];
    },
  });
}

// Payout Liability Snapshot
export function usePayoutLiability() {
  return useQuery({
    queryKey: ['report-payout-liability'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_payout_liability_snapshot')
        .select('*');
      
      if (error) throw error;
      return data as PayoutLiability[];
    },
  });
}

// 1099 Summary by Year
export function use1099Summary(taxYear?: number) {
  return useQuery({
    queryKey: ['report-1099-summary', taxYear],
    queryFn: async () => {
      let query = (supabase as any)
        .from('v_ambassador_1099_summary')
        .select('*');
      
      if (taxYear) {
        query = query.eq('tax_year', taxYear);
      }
      
      const { data, error } = await query.order('total_paid', { ascending: false });
      
      if (error) throw error;
      return data as Ambassador1099Summary[];
    },
  });
}

// Payout Batch Summary
export function usePayoutBatchSummary() {
  return useQuery({
    queryKey: ['report-payout-batch-summary'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_payout_batch_summary')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PayoutBatchSummary[];
    },
  });
}

// Ambassador Monthly Earnings (for a specific ambassador)
export function useAmbassadorMonthlyEarnings(ambassadorId?: string) {
  return useQuery({
    queryKey: ['report-ambassador-monthly-earnings', ambassadorId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('v_ambassador_monthly_earnings')
        .select('*');
      
      if (ambassadorId) {
        query = query.eq('ambassador_id', ambassadorId);
      }
      
      const { data, error } = await query.order('month', { ascending: false }).limit(12);
      
      if (error) throw error;
      return data as AmbassadorMonthlyEarnings[];
    },
    enabled: !!ambassadorId,
  });
}

// Current user's ambassador monthly earnings
export function useMyMonthlyEarnings() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['report-my-monthly-earnings', user?.id],
    queryFn: async () => {
      // First get ambassador ID for current user
      const { data: ambassador, error: ambError } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      
      if (ambError || !ambassador) return [];
      
      const { data, error } = await (supabase as any)
        .from('v_ambassador_monthly_earnings')
        .select('*')
        .eq('ambassador_id', ambassador.id)
        .order('month', { ascending: false })
        .limit(12);
      
      if (error) throw error;
      return data as AmbassadorMonthlyEarnings[];
    },
    enabled: !!user?.id,
  });
}

// Current user's financial summary
export function useMyFinancialSummary() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['report-my-financial-summary', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_ambassador_financial_summary')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (error) throw error;
      return data as AmbassadorFinancialSummary;
    },
    enabled: !!user?.id,
  });
}

// Export helper - converts data to CSV
export function exportToCSV<T extends Record<string, any>>(data: T[], filename: string) {
  if (!data.length) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return val;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
