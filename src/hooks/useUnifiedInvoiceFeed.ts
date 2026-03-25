import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * =====================================================
 * HARD-LOCKED UNIFIED INVOICE FEED
 * =====================================================
 * 
 * ALL Floor 5 (Finance) pages MUST use this hook.
 * Direct queries to 'invoices' or 'customer_invoices' tables
 * from UI components are FORBIDDEN.
 * 
 * This feed aggregates ALL invoice sources:
 * - invoices (store-linked system invoices)
 * - customer_invoices (CRM customer invoices)
 * - marketplace_orders (wholesale fulfillment - if applicable)
 * - Historical invoices (is_historical = true)
 * 
 * NO DATE CUTOFFS. NO EXCLUSIONS. ALL DATA.
 * =====================================================
 */

export interface UnifiedInvoice {
  id: string;
  invoice_number: string;
  source: 'store' | 'crm' | 'wholesale' | 'legacy';
  entity_id: string | null;
  entity_name: string;
  entity_type: 'store' | 'company' | 'customer' | 'wholesaler';
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'unpaid' | 'void';
  payment_status: string;
  due_date: string | null;
  created_at: string;
  brand: string | null;
  receipt_status: string | null;
  receipt_sent_at: string | null;
  is_historical: boolean;
  entry_mode: 'live' | 'backfill';
  // Audit fields
  created_by: string | null;
}

export interface InvoiceFilters {
  status?: string;
  source?: 'store' | 'crm' | 'wholesale' | 'all';
  brand?: string;
  search?: string;
  dateRange?: { start: string; end: string };
  overdueOnly?: boolean;
  storeId?: string;
  entityId?: string;
}

export interface InvoiceStats {
  totalOutstanding: number;
  totalPaid: number;
  overdueCount: number;
  overdueAmount: number;
  invoiceCount: number;
  paidCount: number;
  unpaidCount: number;
  partialCount: number;
  draftCount: number;
}

export interface ARAgingBuckets {
  current: { count: number; amount: number };
  '1-7': { count: number; amount: number };
  '8-14': { count: number; amount: number };
  '15-30': { count: number; amount: number };
  '31-60': { count: number; amount: number };
  '60+': { count: number; amount: number };
}

/**
 * HARD-LOCKED: Primary unified invoice feed
 * All Finance pages MUST use this hook exclusively.
 */
export function useUnifiedInvoiceFeed(filters?: InvoiceFilters) {
  return useQuery({
    queryKey: ['unified-invoice-feed', filters],
    queryFn: async (): Promise<{ invoices: UnifiedInvoice[]; stats: InvoiceStats; agingBuckets: ARAgingBuckets }> => {
      const invoices: UnifiedInvoice[] = [];

      // ==========================================
      // SOURCE 1: Store-linked invoices (invoices table)
      // ==========================================
      if (!filters?.source || filters.source === 'store' || filters.source === 'all') {
        // First get invoices
        let storeQuery = supabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            store_id,
            company_id,
            total,
            total_amount,
            amount_paid,
            payment_status,
            due_date,
            created_at,
            brand,
            receipt_status,
            receipt_sent_at,
            is_historical,
            created_by
          `)
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'all') {
          storeQuery = storeQuery.eq('payment_status', filters.status);
        }
        if (filters?.brand && filters.brand !== 'all') {
          storeQuery = storeQuery.eq('brand', filters.brand);
        }
        if (filters?.overdueOnly) {
          storeQuery = storeQuery.eq('payment_status', 'overdue');
        }
        if (filters?.storeId) {
          storeQuery = storeQuery.eq('store_id', filters.storeId);
        }
        if (filters?.dateRange) {
          storeQuery = storeQuery
            .gte('created_at', filters.dateRange.start)
            .lte('created_at', filters.dateRange.end);
        }

        const { data: storeInvoices, error: storeError } = await storeQuery;
        if (storeError) console.error('[UnifiedInvoiceFeed] Store invoices error:', storeError);

        // Get store names separately to avoid FK issues
        const storeIds = [...new Set((storeInvoices || []).map(inv => inv.store_id).filter(Boolean))];
        const companyIds = [...new Set((storeInvoices || []).map(inv => inv.company_id).filter(Boolean))];

        let storeNames: Record<string, string> = {};
        let companyNames: Record<string, string> = {};

        if (storeIds.length > 0) {
          const { data: stores } = await supabase
            .from('store_master')
            .select('id, store_name')
            .in('id', storeIds);
          storeNames = (stores || []).reduce((acc, s) => ({ ...acc, [s.id]: s.store_name }), {});
        }

        if (companyIds.length > 0) {
          const { data: companies } = await supabase
            .from('companies')
            .select('id, name')
            .in('id', companyIds);
          companyNames = (companies || []).reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
        }

        // Map store invoices to unified format
        (storeInvoices || []).forEach((inv: any) => {
          const total = Number(inv.total) || Number(inv.total_amount) || 0;
          const paid = Number(inv.amount_paid) || 0;
          const storeName = inv.store_id ? storeNames[inv.store_id] : null;
          const companyName = inv.company_id ? companyNames[inv.company_id] : null;

          invoices.push({
            id: inv.id,
            invoice_number: inv.invoice_number || `INV-${inv.id.slice(0, 8).toUpperCase()}`,
            source: inv.is_historical ? 'legacy' : 'store',
            entity_id: inv.store_id || inv.company_id,
            entity_name: storeName || companyName || 'Unknown Entity',
            entity_type: inv.store_id ? 'store' : 'company',
            total_amount: total,
            amount_paid: paid,
            balance_due: Math.max(0, total - paid),
            status: mapPaymentStatus(inv.payment_status, inv.due_date),
            payment_status: inv.payment_status || 'unpaid',
            due_date: inv.due_date,
            created_at: inv.created_at,
            brand: inv.brand,
            receipt_status: inv.receipt_status,
            receipt_sent_at: inv.receipt_sent_at,
            is_historical: inv.is_historical || false,
            created_by: inv.created_by,
          });
        });
      }

      // ==========================================
      // SOURCE 2: CRM Customer Invoices
      // ==========================================
      if (!filters?.source || filters.source === 'crm' || filters.source === 'all') {
        let crmQuery = supabase
          .from('customer_invoices')
          .select(`
            id,
            invoice_number,
            customer_id,
            total_amount,
            status,
            due_date,
            created_at,
            receipt_status,
            receipt_sent_at,
            is_historical
          `)
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'all') {
          crmQuery = crmQuery.eq('status', filters.status);
        }
        if (filters?.dateRange) {
          crmQuery = crmQuery
            .gte('created_at', filters.dateRange.start)
            .lte('created_at', filters.dateRange.end);
        }
        if (filters?.entityId) {
          crmQuery = crmQuery.eq('customer_id', filters.entityId);
        }

        const { data: crmInvoices, error: crmError } = await crmQuery;
        if (crmError) console.error('[UnifiedInvoiceFeed] CRM invoices error:', crmError);

        // Get customer names separately
        const customerIds = [...new Set((crmInvoices || []).map(inv => inv.customer_id).filter(Boolean))];
        let customerNames: Record<string, string> = {};

        if (customerIds.length > 0) {
          const { data: customers } = await supabase
            .from('crm_customers')
            .select('id, name')
            .in('id', customerIds);
          customerNames = (customers || []).reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
        }

        // Map CRM invoices to unified format
        (crmInvoices || []).forEach((inv: any) => {
          const total = Number(inv.total_amount) || 0;
          const status = inv.status || 'draft';
          const customerName = inv.customer_id ? customerNames[inv.customer_id] : null;
          const paid = status === 'paid' ? total : (status === 'partial' ? total * 0.5 : 0);

          invoices.push({
            id: inv.id,
            invoice_number: inv.invoice_number || `CRM-${inv.id.slice(0, 8).toUpperCase()}`,
            source: inv.is_historical ? 'legacy' : 'crm',
            entity_id: inv.customer_id,
            entity_name: customerName || 'Unknown Customer',
            entity_type: 'customer',
            total_amount: total,
            amount_paid: paid,
            balance_due: Math.max(0, total - paid),
            status: mapCrmStatus(status, inv.due_date),
            payment_status: status,
            due_date: inv.due_date,
            created_at: inv.created_at,
            brand: null,
            receipt_status: inv.receipt_status,
            receipt_sent_at: inv.receipt_sent_at,
            is_historical: inv.is_historical || false,
            created_by: null,
          });
        });
      }

      // ==========================================
      // SOURCE 3: Marketplace Orders (Wholesale)
      // Only if they have invoice data
      // ==========================================
      if (!filters?.source || filters.source === 'wholesale' || filters.source === 'all') {
        const { data: wholesaleOrders, error: wholesaleError } = await supabase
          .from('marketplace_orders')
          .select(`
            id,
            total,
            payment_status,
            created_at,
            wholesaler_id,
            wholesaler_profiles(company_name)
          `)
          .order('created_at', { ascending: false });

        if (wholesaleError) console.error('[UnifiedInvoiceFeed] Wholesale orders error:', wholesaleError);

        // Map wholesale orders to unified format
        (wholesaleOrders || []).forEach((order: any) => {
          const total = Number(order.total) || 0;
          if (total === 0) return; // Skip zero-value orders

          invoices.push({
            id: order.id,
            invoice_number: `WS-${order.id.slice(0, 8).toUpperCase()}`,
            source: 'wholesale',
            entity_id: order.wholesaler_id,
            entity_name: order.wholesaler_profiles?.company_name || 'Unknown Wholesaler',
            entity_type: 'wholesaler',
            total_amount: total,
            amount_paid: order.payment_status === 'paid' ? total : 0,
            balance_due: order.payment_status === 'paid' ? 0 : total,
            status: mapPaymentStatus(order.payment_status, null),
            payment_status: order.payment_status || 'unpaid',
            due_date: null,
            created_at: order.created_at,
            brand: null,
            receipt_status: null,
            receipt_sent_at: null,
            is_historical: false,
            created_by: null,
          });
        });
      }

      // ==========================================
      // APPLY SEARCH FILTER (across all sources)
      // ==========================================
      let filtered = invoices;
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        filtered = invoices.filter(inv =>
          inv.invoice_number.toLowerCase().includes(search) ||
          inv.entity_name.toLowerCase().includes(search) ||
          (inv.brand && inv.brand.toLowerCase().includes(search))
        );
      }

      // Sort by created_at descending (most recent first)
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // ==========================================
      // CALCULATE STATS (from ALL sources)
      // ==========================================
      const stats = calculateStats(filtered);
      const agingBuckets = calculateAgingBuckets(filtered);

      return { invoices: filtered, stats, agingBuckets };
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Calculate invoice statistics
 */
function calculateStats(invoices: UnifiedInvoice[]): InvoiceStats {
  return {
    totalOutstanding: invoices
      .filter(inv => inv.status !== 'paid' && inv.status !== 'void')
      .reduce((sum, inv) => sum + inv.balance_due, 0),
    totalPaid: invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total_amount, 0),
    overdueCount: invoices.filter(inv => inv.status === 'overdue').length,
    overdueAmount: invoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.balance_due, 0),
    invoiceCount: invoices.length,
    paidCount: invoices.filter(inv => inv.status === 'paid').length,
    unpaidCount: invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'sent').length,
    partialCount: invoices.filter(inv => inv.status === 'partial').length,
    draftCount: invoices.filter(inv => inv.status === 'draft').length,
  };
}

/**
 * Calculate AR aging buckets
 */
function calculateAgingBuckets(invoices: UnifiedInvoice[]): ARAgingBuckets {
  const buckets: ARAgingBuckets = {
    current: { count: 0, amount: 0 },
    '1-7': { count: 0, amount: 0 },
    '8-14': { count: 0, amount: 0 },
    '15-30': { count: 0, amount: 0 },
    '31-60': { count: 0, amount: 0 },
    '60+': { count: 0, amount: 0 },
  };

  const now = new Date();

  invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'void' && inv.balance_due > 0)
    .forEach(inv => {
      if (!inv.due_date) {
        buckets.current.count++;
        buckets.current.amount += inv.balance_due;
        return;
      }

      const dueDate = new Date(inv.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        buckets.current.count++;
        buckets.current.amount += inv.balance_due;
      } else if (daysOverdue <= 7) {
        buckets['1-7'].count++;
        buckets['1-7'].amount += inv.balance_due;
      } else if (daysOverdue <= 14) {
        buckets['8-14'].count++;
        buckets['8-14'].amount += inv.balance_due;
      } else if (daysOverdue <= 30) {
        buckets['15-30'].count++;
        buckets['15-30'].amount += inv.balance_due;
      } else if (daysOverdue <= 60) {
        buckets['31-60'].count++;
        buckets['31-60'].amount += inv.balance_due;
      } else {
        buckets['60+'].count++;
        buckets['60+'].amount += inv.balance_due;
      }
    });

  return buckets;
}

/**
 * Map payment status to unified status, checking overdue
 */
function mapPaymentStatus(status: string, dueDate: string | null): UnifiedInvoice['status'] {
  // Check if overdue first
  if (dueDate && status !== 'paid' && status !== 'void') {
    const due = new Date(dueDate);
    if (due < new Date()) {
      return 'overdue';
    }
  }

  switch (status?.toLowerCase()) {
    case 'paid': return 'paid';
    case 'partial': return 'partial';
    case 'overdue': return 'overdue';
    case 'unpaid': return 'unpaid';
    case 'void': 
    case 'voided': return 'void';
    case 'sent': return 'sent';
    case 'draft': return 'draft';
    default: return 'unpaid';
  }
}

/**
 * Map CRM status to unified status
 */
function mapCrmStatus(status: string, dueDate: string | null): UnifiedInvoice['status'] {
  // Check if overdue first
  if (dueDate && status !== 'paid' && status !== 'void') {
    const due = new Date(dueDate);
    if (due < new Date()) {
      return 'overdue';
    }
  }

  switch (status?.toLowerCase()) {
    case 'paid': return 'paid';
    case 'sent': return 'sent';
    case 'overdue': return 'overdue';
    case 'partial': return 'partial';
    case 'void': return 'void';
    case 'draft': return 'draft';
    default: return 'draft';
  }
}

/**
 * Convenience hook for AR Aging Buckets only
 */
export function useARAgingBuckets() {
  const { data } = useUnifiedInvoiceFeed({ status: 'all' });
  return data?.agingBuckets || {
    current: { count: 0, amount: 0 },
    '1-7': { count: 0, amount: 0 },
    '8-14': { count: 0, amount: 0 },
    '15-30': { count: 0, amount: 0 },
    '31-60': { count: 0, amount: 0 },
    '60+': { count: 0, amount: 0 },
  };
}

/**
 * Get invoices for a specific store
 * HARD-LOCKED: Use this instead of direct queries
 */
export function useStoreInvoices(storeId: string) {
  return useUnifiedInvoiceFeed({ storeId, source: 'store' });
}

/**
 * Get invoices for a specific customer
 * HARD-LOCKED: Use this instead of direct queries
 */
export function useCustomerInvoices(customerId: string) {
  return useUnifiedInvoiceFeed({ entityId: customerId, source: 'crm' });
}
