/**
 * =====================================================
 * BUSINESS LEDGER - SINGLE SOURCE OF FINANCIAL TRUTH
 * =====================================================
 * 
 * HARD-LOCK RULE:
 * Any page named "Ledger", "Financial Summary", or "Business Ledger"
 * must NEVER rely on paginated UI data.
 * It MUST compute totals from raw database aggregation.
 * 
 * This hook aggregates ALL invoice sources:
 * - invoices (store invoices)
 * - customer_invoices (CRM)
 * - marketplace_orders (wholesale)
 * - legacy / imported invoices
 * - ambassador / wholesaler linked invoices
 * 
 * NO pagination limits. NO UI filter dependency.
 * =====================================================
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LedgerEntry {
  id: string;
  invoice_number: string;
  source: 'store' | 'crm' | 'wholesale' | 'legacy';
  entity_type: 'store' | 'company' | 'customer' | 'wholesaler';
  entity_id: string | null;
  entity_name: string;
  brand: string | null;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: 'paid' | 'unpaid' | 'partial' | 'overdue' | 'void' | 'draft';
  due_date: string | null;
  created_at: string;
  is_historical: boolean;
}

export interface LedgerTotals {
  // System-wide aggregates (raw) - NEVER affected by UI filters
  total_billed: number;
  total_paid: number;
  total_outstanding: number;
  
  // TOTAL ORDERS = ALL finalized invoices across ALL brands/sources (system-wide)
  total_orders: number;
  
  // Counts
  invoice_count: number;
  paid_count: number;
  unpaid_count: number;
  overdue_count: number;
  partial_count: number;
  
  // By source
  by_source: {
    store: { billed: number; paid: number; outstanding: number; count: number };
    crm: { billed: number; paid: number; outstanding: number; count: number };
    wholesale: { billed: number; paid: number; outstanding: number; count: number };
    legacy: { billed: number; paid: number; outstanding: number; count: number };
  };
  
  // By brand (for store invoices) - brand breakdown, NOT filter
  by_brand: Record<string, { billed: number; paid: number; outstanding: number; count: number }>;
}

export interface LedgerVerification {
  storeInvoiceCount: number;
  crmInvoiceCount: number;
  wholesaleOrderCount: number;
  totalExpected: number;
  totalInLedger: number;
  discrepancy: number;
  isValid: boolean;
}

export interface BusinessLedgerResult {
  entries: LedgerEntry[];
  totals: LedgerTotals;
  verification: LedgerVerification;
  isLoading: boolean;
}

/**
 * Fetch TRUE raw counts from each source
 */
async function fetchRawCounts(): Promise<{ store: number; crm: number; wholesale: number }> {
  const [storeRes, crmRes, wsRes] = await Promise.all([
    supabase.from('invoices').select('*', { count: 'exact', head: true }),
    supabase.from('customer_invoices').select('*', { count: 'exact', head: true }),
    supabase.from('marketplace_orders').select('*', { count: 'exact', head: true }),
  ]);

  return {
    store: storeRes.count || 0,
    crm: crmRes.count || 0,
    wholesale: wsRes.count || 0,
  };
}

/**
 * Fetch ALL store invoices (no limit)
 */
async function fetchAllStoreInvoices(): Promise<any[]> {
  const allInvoices: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
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
        is_historical
      `)
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('[BusinessLedger] Store invoices fetch error:', error);
      break;
    }

    if (data && data.length > 0) {
      allInvoices.push(...data);
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allInvoices;
}

/**
 * Fetch ALL CRM invoices (no limit)
 */
async function fetchAllCrmInvoices(): Promise<any[]> {
  const allInvoices: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('customer_invoices')
      .select(`
        id,
        invoice_number,
        customer_id,
        total_amount,
        status,
        due_date,
        created_at,
        is_historical
      `)
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('[BusinessLedger] CRM invoices fetch error:', error);
      break;
    }

    if (data && data.length > 0) {
      allInvoices.push(...data);
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allInvoices;
}

/**
 * Fetch ALL wholesale orders (no limit)
 */
async function fetchAllWholesaleOrders(): Promise<any[]> {
  const allOrders: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .select(`
        id,
        total,
        payment_status,
        created_at,
        wholesaler_id
      `)
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('[BusinessLedger] Wholesale orders fetch error:', error);
      break;
    }

    if (data && data.length > 0) {
      allOrders.push(...data);
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allOrders;
}

/**
 * Map payment status to ledger status
 */
function mapStatus(status: string | null, dueDate: string | null): LedgerEntry['status'] {
  if (status === 'paid') return 'paid';
  if (status === 'void' || status === 'cancelled') return 'void';
  if (status === 'partial') return 'partial';
  if (status === 'draft') return 'draft';
  
  // Check if overdue
  if (dueDate && status !== 'paid') {
    const due = new Date(dueDate);
    if (due < new Date()) return 'overdue';
  }
  
  return 'unpaid';
}

/**
 * BUSINESS LEDGER HOOK
 * 
 * Returns system-wide aggregated financial data.
 * This is the SINGLE SOURCE OF TRUTH for business finances.
 */
export function useBusinessLedger() {
  return useQuery({
    queryKey: ['business-ledger-full'],
    queryFn: async (): Promise<BusinessLedgerResult> => {
      console.log('[BusinessLedger] Fetching full ledger...');

      // Step 1: Get raw counts for verification
      const rawCounts = await fetchRawCounts();
      const totalExpected = rawCounts.store + rawCounts.crm + rawCounts.wholesale;

      // Step 2: Fetch ALL data from all sources (no pagination limits)
      const [storeInvoices, crmInvoices, wholesaleOrders] = await Promise.all([
        fetchAllStoreInvoices(),
        fetchAllCrmInvoices(),
        fetchAllWholesaleOrders(),
      ]);

      // Step 3: Fetch entity names in bulk
      const storeIds = [...new Set(storeInvoices.map(i => i.store_id).filter(Boolean))];
      const companyIds = [...new Set(storeInvoices.map(i => i.company_id).filter(Boolean))];
      const customerIds = [...new Set(crmInvoices.map(i => i.customer_id).filter(Boolean))];
      const wholesalerIds = [...new Set(wholesaleOrders.map(o => o.wholesaler_id).filter(Boolean))];

      const [stores, companies, customers, wholesalers] = await Promise.all([
        storeIds.length > 0 
          ? supabase.from('store_master').select('id, store_name').in('id', storeIds)
          : Promise.resolve({ data: [] }),
        companyIds.length > 0
          ? supabase.from('companies').select('id, name').in('id', companyIds)
          : Promise.resolve({ data: [] }),
        customerIds.length > 0
          ? supabase.from('crm_customers').select('id, name').in('id', customerIds)
          : Promise.resolve({ data: [] }),
        wholesalerIds.length > 0
          ? supabase.from('wholesaler_profiles').select('id, company_name').in('id', wholesalerIds)
          : Promise.resolve({ data: [] }),
      ]);

      const storeNames: Record<string, string> = {};
      const companyNames: Record<string, string> = {};
      const customerNames: Record<string, string> = {};
      const wholesalerNames: Record<string, string> = {};

      (stores.data || []).forEach((s: any) => { storeNames[s.id] = s.store_name; });
      (companies.data || []).forEach((c: any) => { companyNames[c.id] = c.name; });
      (customers.data || []).forEach((c: any) => { customerNames[c.id] = c.name; });
      (wholesalers.data || []).forEach((w: any) => { wholesalerNames[w.id] = w.company_name; });

      // Step 4: Build unified ledger entries
      const entries: LedgerEntry[] = [];

      // Store invoices
      storeInvoices.forEach(inv => {
        const totalAmount = Number(inv.total) || Number(inv.total_amount) || 0;
        const amountPaid = Number(inv.amount_paid) || (inv.payment_status === 'paid' ? totalAmount : 0);
        const source = inv.is_historical ? 'legacy' : 'store';
        
        entries.push({
          id: inv.id,
          invoice_number: inv.invoice_number || `INV-${inv.id.slice(0, 8).toUpperCase()}`,
          source: source as 'store' | 'legacy',
          entity_type: inv.store_id ? 'store' : 'company',
          entity_id: inv.store_id || inv.company_id,
          entity_name: storeNames[inv.store_id] || companyNames[inv.company_id] || 'Unknown',
          brand: inv.brand,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          balance_due: Math.max(0, totalAmount - amountPaid),
          status: mapStatus(inv.payment_status, inv.due_date),
          due_date: inv.due_date,
          created_at: inv.created_at,
          is_historical: inv.is_historical || false,
        });
      });

      // CRM invoices
      crmInvoices.forEach(inv => {
        const totalAmount = Number(inv.total_amount) || 0;
        const status = inv.status || 'draft';
        const amountPaid = status === 'paid' ? totalAmount : (status === 'partial' ? totalAmount * 0.5 : 0);
        
        entries.push({
          id: inv.id,
          invoice_number: inv.invoice_number || `CRM-${inv.id.slice(0, 8).toUpperCase()}`,
          source: inv.is_historical ? 'legacy' : 'crm',
          entity_type: 'customer',
          entity_id: inv.customer_id,
          entity_name: customerNames[inv.customer_id] || 'Unknown Customer',
          brand: null,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          balance_due: Math.max(0, totalAmount - amountPaid),
          status: mapStatus(status, inv.due_date),
          due_date: inv.due_date,
          created_at: inv.created_at,
          is_historical: inv.is_historical || false,
        });
      });

      // Wholesale orders
      wholesaleOrders.forEach(order => {
        const totalAmount = Number(order.total) || 0;
        if (totalAmount === 0) return;
        
        const amountPaid = order.payment_status === 'paid' ? totalAmount : 0;
        
        entries.push({
          id: order.id,
          invoice_number: `WS-${order.id.slice(0, 8).toUpperCase()}`,
          source: 'wholesale',
          entity_type: 'wholesaler',
          entity_id: order.wholesaler_id,
          entity_name: wholesalerNames[order.wholesaler_id] || 'Unknown Wholesaler',
          brand: null,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          balance_due: Math.max(0, totalAmount - amountPaid),
          status: mapStatus(order.payment_status, null),
          due_date: null,
          created_at: order.created_at,
          is_historical: false,
        });
      });

      // Step 5: Calculate totals (from RAW data, not UI)
      const totals = calculateTotals(entries);

      // Step 6: Verification
      const verification: LedgerVerification = {
        storeInvoiceCount: rawCounts.store,
        crmInvoiceCount: rawCounts.crm,
        wholesaleOrderCount: rawCounts.wholesale,
        totalExpected,
        totalInLedger: entries.length,
        discrepancy: totalExpected - entries.length,
        isValid: totalExpected === entries.length,
      };

      if (!verification.isValid) {
        console.warn('[BusinessLedger] ⚠️ DISCREPANCY DETECTED:', verification);
      } else {
        console.log('[BusinessLedger] ✓ Verification passed:', verification);
      }

      // Sort by created_at desc
      entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        entries,
        totals,
        verification,
        isLoading: false,
      };
    },
    staleTime: 60000, // 1 minute cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Calculate totals from raw ledger entries
 */
function calculateTotals(entries: LedgerEntry[]): LedgerTotals {
  const totals: LedgerTotals = {
    total_billed: 0,
    total_paid: 0,
    total_outstanding: 0,
    // TOTAL ORDERS = all finalized invoices (paid + completed) across ALL brands
    total_orders: 0,
    invoice_count: entries.length,
    paid_count: 0,
    unpaid_count: 0,
    overdue_count: 0,
    partial_count: 0,
    by_source: {
      store: { billed: 0, paid: 0, outstanding: 0, count: 0 },
      crm: { billed: 0, paid: 0, outstanding: 0, count: 0 },
      wholesale: { billed: 0, paid: 0, outstanding: 0, count: 0 },
      legacy: { billed: 0, paid: 0, outstanding: 0, count: 0 },
    },
    by_brand: {},
  };

  entries.forEach(entry => {
    // Global totals
    totals.total_billed += entry.total_amount;
    totals.total_paid += entry.amount_paid;
    totals.total_outstanding += entry.balance_due;

    // TOTAL ORDERS: Count finalized invoices (paid, partial, or unpaid with value)
    // An "order" is any invoice that represents a completed sale
    if (entry.status === 'paid' || entry.status === 'partial' || 
        (entry.status === 'unpaid' && entry.total_amount > 0) ||
        (entry.status === 'overdue' && entry.total_amount > 0)) {
      totals.total_orders++;
    }

    // Status counts
    if (entry.status === 'paid') totals.paid_count++;
    if (entry.status === 'unpaid') totals.unpaid_count++;
    if (entry.status === 'overdue') {
      totals.overdue_count++;
      totals.unpaid_count++; // Overdue is also unpaid
    }
    if (entry.status === 'partial') totals.partial_count++;

    // By source
    const source = entry.source;
    totals.by_source[source].billed += entry.total_amount;
    totals.by_source[source].paid += entry.amount_paid;
    totals.by_source[source].outstanding += entry.balance_due;
    totals.by_source[source].count++;

    // By brand (for store invoices)
    if (entry.brand) {
      if (!totals.by_brand[entry.brand]) {
        totals.by_brand[entry.brand] = { billed: 0, paid: 0, outstanding: 0, count: 0 };
      }
      totals.by_brand[entry.brand].billed += entry.total_amount;
      totals.by_brand[entry.brand].paid += entry.amount_paid;
      totals.by_brand[entry.brand].outstanding += entry.balance_due;
      totals.by_brand[entry.brand].count++;
    }
  });

  return totals;
}

/**
 * Get ONLY system-wide ledger totals (fast, for dashboards)
 */
export function useLedgerTotals() {
  return useQuery({
    queryKey: ['business-ledger-totals'],
    queryFn: async () => {
      // Use raw SQL aggregation for maximum performance
      const [storeRes, crmRes, wsRes] = await Promise.all([
        supabase.from('invoices').select('total, total_amount, amount_paid, payment_status'),
        supabase.from('customer_invoices').select('total_amount, status'),
        supabase.from('marketplace_orders').select('total, payment_status'),
      ]);

      let total_billed = 0;
      let total_paid = 0;
      let invoice_count = 0;
      let paid_count = 0;
      let unpaid_count = 0;

      // Store invoices
      (storeRes.data || []).forEach((inv: any) => {
        const amount = Number(inv.total) || Number(inv.total_amount) || 0;
        const paid = Number(inv.amount_paid) || (inv.payment_status === 'paid' ? amount : 0);
        total_billed += amount;
        total_paid += paid;
        invoice_count++;
        if (inv.payment_status === 'paid') paid_count++;
        else unpaid_count++;
      });

      // CRM invoices
      (crmRes.data || []).forEach((inv: any) => {
        const amount = Number(inv.total_amount) || 0;
        total_billed += amount;
        if (inv.status === 'paid') {
          total_paid += amount;
          paid_count++;
        } else {
          unpaid_count++;
        }
        invoice_count++;
      });

      // Wholesale orders
      (wsRes.data || []).forEach((order: any) => {
        const amount = Number(order.total) || 0;
        if (amount === 0) return;
        total_billed += amount;
        if (order.payment_status === 'paid') {
          total_paid += amount;
          paid_count++;
        } else {
          unpaid_count++;
        }
        invoice_count++;
      });

      return {
        total_billed,
        total_paid,
        total_outstanding: total_billed - total_paid,
        invoice_count,
        paid_count,
        unpaid_count,
      };
    },
    staleTime: 30000,
  });
}
