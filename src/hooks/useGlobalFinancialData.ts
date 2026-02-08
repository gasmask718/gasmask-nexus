/**
 * useGlobalFinancialData — Centralized hook for Accounting OS Global Intelligence
 * 
 * Consumes ONLY from normalization schema:
 * - businesses (registry)
 * - business_financial_profiles
 * - business_financial_snapshots
 * - industry_catalog
 * - expense_category_catalog
 * - revenue_category_catalog
 * 
 * NEVER depends on raw transactional tables at Penthouse level.
 * Snapshots > Transactions.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────

export type ConnectionStatus = 'api_connected' | 'partial' | 'manual' | 'not_connected' | 'external_pending';
export type ReportingMode = 'live' | 'daily_summary' | 'weekly_summary' | 'manual_only' | 'estimated' | 'placeholder';
export type DataSource = 'live' | 'manual' | 'estimated' | 'placeholder';

export interface BusinessEntity {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  business_type: string | null;
  operational_status: string | null;
  ownership_type: string | null;
  is_active: boolean;
  // Financial profile
  connection_status: ConnectionStatus;
  revenue_source: string;
  reporting_mode: ReportingMode;
  data_confidence_pct: number;
  monthly_revenue_estimate: number;
  monthly_expense_estimate: number;
  last_data_sync_at: string | null;
  industry_catalog_id: string | null;
}

export interface FinancialSnapshot {
  id: string;
  business_id: string;
  snapshot_date: string;
  period_type: string;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  data_source: DataSource;
  confidence_score: number;
  revenue_breakdown: Record<string, number> | null;
  expense_breakdown: Record<string, number> | null;
  notes: string | null;
}

export interface IndustryCatalogEntry {
  id: string;
  industry_name: string;
  industry_group: string;
  margin_expectation_low: number;
  margin_expectation_high: number;
  notes: string | null;
}

export interface ExpenseCategoryEntry {
  id: string;
  category_name: string;
  category_group: string;
  tax_deductible: boolean;
}

export interface RevenueCategoryEntry {
  id: string;
  category_name: string;
  revenue_group: string;
}

// ─── Hook: All Business Entities ─────────────────────────────────────────

export function useBusinessEntities() {
  return useQuery({
    queryKey: ['global-business-entities'],
    queryFn: async (): Promise<BusinessEntity[]> => {
      const [{ data: businesses }, { data: profiles }] = await Promise.all([
        supabase.from('businesses').select('id, name, slug, industry, is_active, business_type, operational_status, ownership_type'),
        supabase.from('business_financial_profiles').select('*'),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.business_id, p]));

      // Include ALL businesses — active AND inactive (placeholder/prelaunch)
      return (businesses || []).map(b => {
        const fp = profileMap.get(b.id);
        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          industry: b.industry,
          is_active: b.is_active,
          business_type: b.business_type,
          operational_status: b.operational_status,
          ownership_type: b.ownership_type,
          connection_status: (fp?.connection_status as ConnectionStatus) || 'not_connected',
          revenue_source: fp?.revenue_source || 'offline',
          reporting_mode: (fp?.reporting_mode as ReportingMode) || 'placeholder',
          data_confidence_pct: fp?.data_confidence_pct || 0,
          monthly_revenue_estimate: Number(fp?.monthly_revenue_estimate || 0),
          monthly_expense_estimate: Number(fp?.monthly_expense_estimate || 0),
          last_data_sync_at: fp?.last_data_sync_at || null,
          industry_catalog_id: fp?.industry_catalog_id || null,
        };
      });
    },
    refetchInterval: 120000,
  });
}

// ─── Hook: Financial Snapshots ───────────────────────────────────────────

export function useFinancialSnapshots(months: number = 12) {
  return useQuery({
    queryKey: ['global-financial-snapshots', months],
    queryFn: async (): Promise<FinancialSnapshot[]> => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data } = await supabase
        .from('business_financial_snapshots')
        .select('*')
        .gte('snapshot_date', startDate.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true });

      return (data || []).map(s => ({
        id: s.id,
        business_id: s.business_id,
        snapshot_date: s.snapshot_date,
        period_type: s.period_type,
        total_revenue: Number(s.total_revenue || 0),
        total_expenses: Number(s.total_expenses || 0),
        net_profit: Number(s.net_profit || 0),
        data_source: (s.data_source as DataSource) || 'manual',
        confidence_score: s.confidence_score || 0,
        revenue_breakdown: s.revenue_breakdown as Record<string, number> | null,
        expense_breakdown: s.expense_breakdown as Record<string, number> | null,
        notes: s.notes,
      }));
    },
    refetchInterval: 120000,
  });
}

// ─── Hook: Industry Catalog ─────────────────────────────────────────────

export function useIndustryCatalog() {
  return useQuery({
    queryKey: ['industry-catalog'],
    queryFn: async (): Promise<IndustryCatalogEntry[]> => {
      const { data } = await supabase.from('industry_catalog').select('*').order('industry_name');
      return (data || []).map(c => ({
        id: c.id,
        industry_name: c.industry_name,
        industry_group: c.industry_group,
        margin_expectation_low: Number(c.margin_expectation_low || 0),
        margin_expectation_high: Number(c.margin_expectation_high || 0),
        notes: c.notes,
      }));
    },
    staleTime: 300000,
  });
}

// ─── Hook: Expense Category Catalog ─────────────────────────────────────

export function useExpenseCategoryCatalog() {
  return useQuery({
    queryKey: ['expense-category-catalog'],
    queryFn: async (): Promise<ExpenseCategoryEntry[]> => {
      const { data } = await supabase.from('expense_category_catalog').select('*').order('category_name');
      return (data || []).map(c => ({
        id: c.id,
        category_name: c.category_name,
        category_group: c.category_group,
        tax_deductible: c.tax_deductible || false,
      }));
    },
    staleTime: 300000,
  });
}

// ─── Hook: Revenue Category Catalog ─────────────────────────────────────

export function useRevenueCategoryCatalog() {
  return useQuery({
    queryKey: ['revenue-category-catalog'],
    queryFn: async (): Promise<RevenueCategoryEntry[]> => {
      const { data } = await supabase.from('revenue_category_catalog').select('*').order('category_name');
      return (data || []).map(c => ({
        id: c.id,
        category_name: c.category_name,
        revenue_group: c.revenue_group,
      }));
    },
    staleTime: 300000,
  });
}

// ─── Utility: Confidence Label ──────────────────────────────────────────

export function getConfidenceLabel(pct: number): { label: string; className: string } {
  if (pct >= 80) return { label: 'Live Data', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
  if (pct >= 50) return { label: 'Partial Data', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
  if (pct > 0) return { label: 'Estimated', className: 'bg-orange-500/20 text-orange-300 border-orange-500/40' };
  return { label: 'Awaiting Data', className: 'bg-muted/50 text-muted-foreground border-muted' };
}

export function getConnectionLabel(status: ConnectionStatus): { label: string; className: string; icon: 'live' | 'partial' | 'manual' | 'pending' | 'disconnected' } {
  switch (status) {
    case 'api_connected': return { label: 'Live', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: 'live' };
    case 'partial': return { label: 'Partial', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: 'partial' };
    case 'manual': return { label: 'Manual', className: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: 'manual' };
    case 'external_pending': return { label: 'Pending', className: 'bg-purple-500/20 text-purple-300 border-purple-500/40', icon: 'pending' };
    default: return { label: 'Not Connected', className: 'bg-muted/50 text-muted-foreground border-muted', icon: 'disconnected' };
  }
}

export function getReportingLabel(mode: ReportingMode): string {
  switch (mode) {
    case 'live': return 'Live Sync';
    case 'daily_summary': return 'Daily Summary';
    case 'weekly_summary': return 'Weekly Summary';
    case 'manual_only': return 'Manual Only';
    case 'estimated': return 'AI Estimated';
    case 'placeholder': return 'Awaiting Integration';
    default: return 'Unknown';
  }
}
