import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedInvoice, InvoiceFilters, InvoiceStats, ARAgingBuckets } from './useUnifiedInvoiceFeed';

/**
 * =====================================================
 * PAGINATED UNIFIED INVOICE FEED
 * =====================================================
 * 
 * This hook provides TRUE pagination with:
 * - Server-side counting (no 1000 row limits)
 * - Range-based pagination
 * - Full verification stats
 * 
 * Used by Floor 5 pages that need pagination.
 * =====================================================
 */

export interface PaginatedInvoiceResult {
  invoices: UnifiedInvoice[];
  stats: InvoiceStats;
  agingBuckets: ARAgingBuckets;
  pagination: {
    totalCount: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
  };
  verification: {
    storeInvoiceCount: number;
    crmInvoiceCount: number;
    wholesaleOrderCount: number;
    totalExpected: number;
    totalInFeed: number;
    discrepancy: number;
  };
}

export interface PaginatedFilters extends InvoiceFilters {
  page?: number;
  pageSize?: number;
  // Additional filters used by BillingInvoices
  startDate?: string;
  endDate?: string;
  sortBy?: "created_at" | "updated_at";
}

/**
 * Get TRUE invoice counts directly from database
 * Bypasses any query limits
 */
async function getTrueInvoiceCounts() {
  // Get count from invoices table
  const { count: storeCount, error: storeErr } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true });

  // Get count from customer_invoices table  
  const { count: crmCount, error: crmErr } = await supabase
    .from('customer_invoices')
    .select('*', { count: 'exact', head: true });

  // Get count from marketplace_orders (wholesale)
  const { count: wholesaleCount, error: wsErr } = await supabase
    .from('marketplace_orders')
    .select('*', { count: 'exact', head: true });

  if (storeErr) console.error('[PaginatedFeed] Store count error:', storeErr);
  if (crmErr) console.error('[PaginatedFeed] CRM count error:', crmErr);
  if (wsErr) console.error('[PaginatedFeed] Wholesale count error:', wsErr);

  return {
    storeInvoiceCount: storeCount || 0,
    crmInvoiceCount: crmCount || 0,
    wholesaleOrderCount: wholesaleCount || 0,
  };
}

/**
 * Fetch paginated store invoices with range
 */
async function fetchStoreInvoices(
  filters: PaginatedFilters,
  from: number,
  to: number
): Promise<{ invoices: any[]; total: number }> {
  let query = supabase
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
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.status && filters.status !== 'all') {
    query = query.eq('payment_status', filters.status);
  }
  if (filters.brand && filters.brand !== 'all') {
    query = query.eq('brand', filters.brand);
  }
  if (filters.overdueOnly) {
    query = query.eq('payment_status', 'overdue');
  }
  if (filters.storeId) {
    query = query.eq('store_id', filters.storeId);
  }
  if (filters.dateRange) {
    query = query
      .gte('created_at', filters.dateRange.start)
      .lte('created_at', filters.dateRange.end);
  }

  // SERVER-SIDE SEARCH: filter by invoice_number at the DB level
  if (filters.search) {
    query = query.ilike('invoice_number', `%${filters.search}%`);
  }

  // Apply pagination range
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) console.error('[PaginatedFeed] Store invoices error:', error);

  return { invoices: data || [], total: count || 0 };
}

/**
 * Fetch paginated CRM invoices with range
 */
async function fetchCrmInvoices(
  filters: PaginatedFilters,
  from: number,
  to: number
): Promise<{ invoices: any[]; total: number }> {
  let query = supabase
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
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.dateRange) {
    query = query
      .gte('created_at', filters.dateRange.start)
      .lte('created_at', filters.dateRange.end);
  }
  if (filters.entityId) {
    query = query.eq('customer_id', filters.entityId);
  }

  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) console.error('[PaginatedFeed] CRM invoices error:', error);

  return { invoices: data || [], total: count || 0 };
}

/**
 * HARD-LOCKED: Paginated unified invoice feed
 * All Floor 5 pages with large datasets MUST use this hook.
 */
export function usePaginatedInvoiceFeed(filters: PaginatedFilters = {}) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;

  return useQuery({
    queryKey: ['paginated-invoice-feed', filters],
    queryFn: async (): Promise<PaginatedInvoiceResult> => {
      // Get TRUE counts first (bypasses limits)
      const trueCounts = await getTrueInvoiceCounts();
      
      // Calculate pagination range
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const invoices: UnifiedInvoice[] = [];
      let totalStoreFiltered = 0;
      let totalCrmFiltered = 0;
      let totalWholesaleFiltered = 0;

      // Fetch based on source filter
      const sourceFilter = filters.source || 'all';

      // ==========================================
      // SOURCE 1: Store invoices (with pagination)
      // ==========================================
      if (sourceFilter === 'store' || sourceFilter === 'all') {
        const { invoices: storeInvoices, total } = await fetchStoreInvoices(filters, from, to);
        totalStoreFiltered = total;

        // Get store/company names
        const storeIds = [...new Set(storeInvoices.map(inv => inv.store_id).filter(Boolean))];
        const companyIds = [...new Set(storeInvoices.map(inv => inv.company_id).filter(Boolean))];

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

        storeInvoices.forEach((inv: any) => {
          const totalAmount = Number(inv.total) || Number(inv.total_amount) || 0;
          const paid = Number(inv.amount_paid) || 0;

          invoices.push({
            id: inv.id,
            invoice_number: inv.invoice_number || `INV-${inv.id.slice(0, 8).toUpperCase()}`,
            source: inv.is_historical ? 'legacy' : 'store',
            entity_id: inv.store_id || inv.company_id,
            entity_name: storeNames[inv.store_id] || companyNames[inv.company_id] || 'Unknown Entity',
            entity_type: inv.store_id ? 'store' : 'company',
            total_amount: totalAmount,
            amount_paid: paid,
            balance_due: Math.max(0, totalAmount - paid),
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
      // SOURCE 2: CRM invoices (with pagination)
      // ==========================================
      if (sourceFilter === 'crm' || sourceFilter === 'all') {
        const { invoices: crmInvoices, total } = await fetchCrmInvoices(filters, from, to);
        totalCrmFiltered = total;

        const customerIds = [...new Set(crmInvoices.map(inv => inv.customer_id).filter(Boolean))];
        let customerNames: Record<string, string> = {};

        if (customerIds.length > 0) {
          const { data: customers } = await supabase
            .from('crm_customers')
            .select('id, name')
            .in('id', customerIds);
          customerNames = (customers || []).reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
        }

        crmInvoices.forEach((inv: any) => {
          const totalAmount = Number(inv.total_amount) || 0;
          const status = inv.status || 'draft';
          const paid = status === 'paid' ? totalAmount : (status === 'partial' ? totalAmount * 0.5 : 0);

          invoices.push({
            id: inv.id,
            invoice_number: inv.invoice_number || `CRM-${inv.id.slice(0, 8).toUpperCase()}`,
            source: inv.is_historical ? 'legacy' : 'crm',
            entity_id: inv.customer_id,
            entity_name: customerNames[inv.customer_id] || 'Unknown Customer',
            entity_type: 'customer',
            total_amount: totalAmount,
            amount_paid: paid,
            balance_due: Math.max(0, totalAmount - paid),
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
      // SOURCE 3: Wholesale orders (with pagination)
      // ==========================================
      if (sourceFilter === 'wholesale' || sourceFilter === 'all') {
        const { data: wholesaleOrders, count } = await supabase
          .from('marketplace_orders')
          .select(`
            id,
            total,
            payment_status,
            created_at,
            wholesaler_id,
            wholesaler_profiles(company_name)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        totalWholesaleFiltered = count || 0;

        (wholesaleOrders || []).forEach((order: any) => {
          const totalAmount = Number(order.total) || 0;
          if (totalAmount === 0) return;

          invoices.push({
            id: order.id,
            invoice_number: `WS-${order.id.slice(0, 8).toUpperCase()}`,
            source: 'wholesale',
            entity_id: order.wholesaler_id,
            entity_name: order.wholesaler_profiles?.company_name || 'Unknown Wholesaler',
            entity_type: 'wholesaler',
            total_amount: totalAmount,
            amount_paid: order.payment_status === 'paid' ? totalAmount : 0,
            balance_due: order.payment_status === 'paid' ? 0 : totalAmount,
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

      // Apply search filter client-side (after fetch)
      let filtered = invoices;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = invoices.filter(inv =>
          inv.invoice_number.toLowerCase().includes(search) ||
          inv.entity_name.toLowerCase().includes(search) ||
          (inv.brand && inv.brand.toLowerCase().includes(search))
        );
      }

      // Sort by created_at descending
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Calculate filtered total count
      const totalFiltered = sourceFilter === 'all'
        ? totalStoreFiltered + totalCrmFiltered + totalWholesaleFiltered
        : sourceFilter === 'store'
        ? totalStoreFiltered
        : sourceFilter === 'crm'
        ? totalCrmFiltered
        : totalWholesaleFiltered;

      // Calculate stats
      const stats = calculateStats(filtered);
      const agingBuckets = calculateAgingBuckets(filtered);

      // Verification check
      const totalExpected = trueCounts.storeInvoiceCount + trueCounts.crmInvoiceCount + trueCounts.wholesaleOrderCount;
      const verification = {
        ...trueCounts,
        totalExpected,
        totalInFeed: totalFiltered,
        discrepancy: totalExpected - totalFiltered,
      };

      // Log verification warning if discrepancy exists
      if (verification.discrepancy !== 0 && !filters.status && !filters.search) {
        console.warn('[PaginatedFeed] ⚠️ Invoice discrepancy detected:', verification);
      }

      return {
        invoices: filtered,
        stats,
        agingBuckets,
        pagination: {
          totalCount: totalFiltered,
          currentPage: page,
          pageSize,
          totalPages: Math.ceil(totalFiltered / pageSize),
        },
        verification,
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get ONLY the system-wide invoice counts
 * Fast, cheap query for dashboards
 */
export function useInvoiceSystemCounts() {
  return useQuery({
    queryKey: ['invoice-system-counts'],
    queryFn: async () => {
      const counts = await getTrueInvoiceCounts();
      return {
        ...counts,
        totalSystemWide: counts.storeInvoiceCount + counts.crmInvoiceCount + counts.wholesaleOrderCount,
      };
    },
    staleTime: 60000,
  });
}

// Helper functions (same as unified feed)
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

function mapPaymentStatus(status: string, dueDate: string | null): UnifiedInvoice['status'] {
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

function mapCrmStatus(status: string, dueDate: string | null): UnifiedInvoice['status'] {
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
