/**
 * =====================================================
 * UNPAID ACCOUNTS - COLLECTIONS COMMAND CENTER
 * =====================================================
 * 
 * HARD-LOCK RULE:
 * This hook aggregates ALL unpaid invoices across ALL sources
 * and returns ENTITY-FIRST data (grouped by account).
 * 
 * Sources:
 * - invoices (store invoices)
 * - customer_invoices (CRM)
 * - marketplace_orders (wholesale)
 * - legacy / imported invoices
 * 
 * An invoice is "unpaid" if:
 * - status IN ('unpaid', 'partial', 'sent', 'overdue')
 * - OR total_amount > amount_paid
 * - OR balance_due > 0
 * 
 * NO pagination limits on aggregation.
 * NO UI filter dependency for totals.
 * =====================================================
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type EntityType = 'store' | 'company' | 'customer' | 'wholesaler';
export type InvoiceSource = 'store' | 'crm' | 'wholesale' | 'legacy';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface UnpaidInvoice {
  id: string;
  invoice_number: string;
  source: InvoiceSource;
  invoice_date: string;
  due_date: string | null;
  days_overdue: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  brand: string | null;
}

export interface UnpaidAccount {
  entity_id: string;
  entity_name: string;
  entity_type: EntityType;
  brands: string[];
  total_billed: number;
  total_paid: number;
  total_outstanding: number;
  oldest_unpaid_date: string | null;
  max_days_overdue: number;
  unpaid_invoice_count: number;
  risk_level: RiskLevel;
  invoices: UnpaidInvoice[];
  // Additional entity metadata
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  payment_reliability_score?: number;
  payment_reliability_tier?: string;
}

export interface UnpaidAccountsKPI {
  // System-wide (NEVER affected by UI filters)
  total_outstanding: number;
  total_overdue: number;
  unpaid_invoice_count: number;
  overdue_invoice_count: number;
  unique_accounts_count: number;
  average_days_outstanding: number;
  
  // By source breakdown
  by_source: Record<InvoiceSource, { outstanding: number; count: number }>;
  
  // By brand breakdown
  by_brand: Record<string, { outstanding: number; count: number }>;
  
  // Risk breakdown
  by_risk: Record<RiskLevel, { outstanding: number; count: number }>;
}

export interface UnpaidAccountsVerification {
  store_unpaid_count: number;
  crm_unpaid_count: number;
  wholesale_unpaid_count: number;
  total_expected: number;
  total_in_view: number;
  discrepancy: number;
  is_valid: boolean;
}

export interface UnpaidAccountsResult {
  accounts: UnpaidAccount[];
  kpi: UnpaidAccountsKPI;
  verification: UnpaidAccountsVerification;
  isLoading: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function calculateRiskLevel(account: { max_days_overdue: number; total_outstanding: number }): RiskLevel {
  const { max_days_overdue, total_outstanding } = account;
  
  // Critical: > 60 days OR > $5000 outstanding
  if (max_days_overdue > 60 || total_outstanding > 5000) return 'critical';
  
  // High: > 30 days OR > $2000 outstanding
  if (max_days_overdue > 30 || total_outstanding > 2000) return 'high';
  
  // Medium: > 14 days OR > $500 outstanding
  if (max_days_overdue > 14 || total_outstanding > 500) return 'medium';
  
  // Low: everything else
  return 'low';
}

function getDaysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const diff = differenceInDays(new Date(), new Date(dueDate));
  return diff > 0 ? diff : 0;
}

function isUnpaid(status: string | null, totalAmount: number, amountPaid: number): boolean {
  const unpaidStatuses = ['unpaid', 'partial', 'sent', 'overdue', 'pending'];
  if (unpaidStatuses.includes(status?.toLowerCase() || '')) return true;
  if (totalAmount > amountPaid) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA FETCHERS (No limits)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAllUnpaidStoreInvoices(): Promise<any[]> {
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
      .not('payment_status', 'eq', 'paid')
      .not('payment_status', 'eq', 'void')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('[UnpaidAccounts] Store invoices fetch error:', error);
      break;
    }

    if (data && data.length > 0) {
      // Filter for truly unpaid
      const unpaid = data.filter(inv => {
        const total = Number(inv.total) || Number(inv.total_amount) || 0;
        const paid = Number(inv.amount_paid) || 0;
        return isUnpaid(inv.payment_status, total, paid);
      });
      allInvoices.push(...unpaid);
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allInvoices;
}

async function fetchAllUnpaidCrmInvoices(): Promise<any[]> {
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
      .not('status', 'eq', 'paid')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('[UnpaidAccounts] CRM invoices fetch error:', error);
      break;
    }

    if (data && data.length > 0) {
      const unpaid = data.filter(inv => {
        const total = Number(inv.total_amount) || 0;
        return isUnpaid(inv.status, total, 0);
      });
      allInvoices.push(...unpaid);
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allInvoices;
}

async function fetchAllUnpaidWholesaleOrders(): Promise<any[]> {
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
      .not('payment_status', 'eq', 'paid')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('[UnpaidAccounts] Wholesale orders fetch error:', error);
      break;
    }

    if (data && data.length > 0) {
      const unpaid = data.filter(order => {
        const total = Number(order.total) || 0;
        return total > 0 && order.payment_status !== 'paid';
      });
      allOrders.push(...unpaid);
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allOrders;
}

// ─────────────────────────────────────────────────────────────────────────────
// RAW COUNTS FOR VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

async function fetchUnpaidRawCounts(): Promise<{ store: number; crm: number; wholesale: number }> {
  const [storeRes, crmRes, wsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .not('payment_status', 'eq', 'paid')
      .not('payment_status', 'eq', 'void'),
    supabase
      .from('customer_invoices')
      .select('*', { count: 'exact', head: true })
      .not('status', 'eq', 'paid'),
    supabase
      .from('marketplace_orders')
      .select('*', { count: 'exact', head: true })
      .not('payment_status', 'eq', 'paid'),
  ]);

  return {
    store: storeRes.count || 0,
    crm: crmRes.count || 0,
    wholesale: wsRes.count || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useUnpaidAccounts() {
  return useQuery({
    queryKey: ['unpaid-accounts-full'],
    queryFn: async (): Promise<UnpaidAccountsResult> => {
      console.log('[UnpaidAccounts] Fetching all unpaid accounts...');

      // Step 1: Get raw counts for verification
      const rawCounts = await fetchUnpaidRawCounts();
      
      // Step 2: Fetch ALL unpaid data from all sources
      const [storeInvoices, crmInvoices, wholesaleOrders] = await Promise.all([
        fetchAllUnpaidStoreInvoices(),
        fetchAllUnpaidCrmInvoices(),
        fetchAllUnpaidWholesaleOrders(),
      ]);

      // Step 3: Fetch entity metadata in bulk
      const storeIds = [...new Set(storeInvoices.map(i => i.store_id).filter(Boolean))];
      const companyIds = [...new Set(storeInvoices.map(i => i.company_id).filter(Boolean))];
      const customerIds = [...new Set(crmInvoices.map(i => i.customer_id).filter(Boolean))];
      const wholesalerIds = [...new Set(wholesaleOrders.map(o => o.wholesaler_id).filter(Boolean))];

      const [stores, companies, customers, wholesalers] = await Promise.all([
        storeIds.length > 0 
          ? supabase.from('store_master').select('id, store_name, phone, email, city, state').in('id', storeIds)
          : Promise.resolve({ data: [] }),
        companyIds.length > 0
          ? supabase.from('companies').select('id, name, default_phone, default_email, default_city, default_state, payment_reliability_score, payment_reliability_tier').in('id', companyIds)
          : Promise.resolve({ data: [] }),
        customerIds.length > 0
          ? supabase.from('crm_customers').select('id, name, phone, email').in('id', customerIds)
          : Promise.resolve({ data: [] }),
        wholesalerIds.length > 0
          ? supabase.from('wholesaler_profiles').select('id, company_name, contact_phone, contact_email').in('id', wholesalerIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Build entity maps
      const entityMap: Record<string, { 
        name: string; 
        type: EntityType; 
        phone?: string; 
        email?: string;
        city?: string;
        state?: string;
        payment_reliability_score?: number;
        payment_reliability_tier?: string;
      }> = {};

      (stores.data || []).forEach((s: any) => {
        entityMap[s.id] = { 
          name: s.store_name || 'Unknown Store', 
          type: 'store',
          phone: s.phone,
          email: s.email,
          city: s.city,
          state: s.state,
        };
      });

      (companies.data || []).forEach((c: any) => {
        entityMap[c.id] = { 
          name: c.name || 'Unknown Company', 
          type: 'company',
          phone: c.default_phone,
          email: c.default_email,
          city: c.default_city,
          state: c.default_state,
          payment_reliability_score: c.payment_reliability_score,
          payment_reliability_tier: c.payment_reliability_tier,
        };
      });

      (customers.data || []).forEach((c: any) => {
        entityMap[c.id] = { 
          name: c.name || 'Unknown Customer', 
          type: 'customer',
          phone: c.phone,
          email: c.email,
        };
      });

      (wholesalers.data || []).forEach((w: any) => {
        entityMap[w.id] = { 
          name: w.company_name || 'Unknown Wholesaler', 
          type: 'wholesaler',
          phone: w.contact_phone,
          email: w.contact_email,
        };
      });

      // Step 4: Group invoices by entity (ACCOUNT-LEVEL)
      const accountsMap: Record<string, UnpaidAccount> = {};

      // Process store invoices
      storeInvoices.forEach(inv => {
        const entityId = inv.store_id || inv.company_id || 'unknown';
        const entity = entityMap[entityId] || { name: 'Unknown', type: 'store' as EntityType };
        const totalAmount = Number(inv.total) || Number(inv.total_amount) || 0;
        const amountPaid = Number(inv.amount_paid) || 0;
        const balanceDue = Math.max(0, totalAmount - amountPaid);
        const daysOverdue = getDaysOverdue(inv.due_date);
        const source: InvoiceSource = inv.is_historical ? 'legacy' : 'store';

        if (balanceDue <= 0) return; // Skip if no balance

        if (!accountsMap[entityId]) {
          accountsMap[entityId] = {
            entity_id: entityId,
            entity_name: entity.name,
            entity_type: entity.type,
            brands: [],
            total_billed: 0,
            total_paid: 0,
            total_outstanding: 0,
            oldest_unpaid_date: null,
            max_days_overdue: 0,
            unpaid_invoice_count: 0,
            risk_level: 'low',
            invoices: [],
            phone: entity.phone,
            email: entity.email,
            city: entity.city,
            state: entity.state,
            payment_reliability_score: entity.payment_reliability_score,
            payment_reliability_tier: entity.payment_reliability_tier,
          };
        }

        const account = accountsMap[entityId];
        account.total_billed += totalAmount;
        account.total_paid += amountPaid;
        account.total_outstanding += balanceDue;
        account.unpaid_invoice_count++;
        account.max_days_overdue = Math.max(account.max_days_overdue, daysOverdue);

        if (inv.brand && !account.brands.includes(inv.brand)) {
          account.brands.push(inv.brand);
        }

        if (!account.oldest_unpaid_date || new Date(inv.created_at) < new Date(account.oldest_unpaid_date)) {
          account.oldest_unpaid_date = inv.created_at;
        }

        account.invoices.push({
          id: inv.id,
          invoice_number: inv.invoice_number || `INV-${inv.id.slice(0, 8)}`,
          source,
          invoice_date: inv.created_at,
          due_date: inv.due_date,
          days_overdue: daysOverdue,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          balance_due: balanceDue,
          status: inv.payment_status || 'unpaid',
          brand: inv.brand,
        });
      });

      // Process CRM invoices
      crmInvoices.forEach(inv => {
        const entityId = inv.customer_id || 'unknown-crm';
        const entity = entityMap[entityId] || { name: 'Unknown Customer', type: 'customer' as EntityType };
        const totalAmount = Number(inv.total_amount) || 0;
        const amountPaid = inv.status === 'partial' ? totalAmount * 0.5 : 0;
        const balanceDue = Math.max(0, totalAmount - amountPaid);
        const daysOverdue = getDaysOverdue(inv.due_date);
        const source: InvoiceSource = inv.is_historical ? 'legacy' : 'crm';

        if (balanceDue <= 0) return;

        if (!accountsMap[entityId]) {
          accountsMap[entityId] = {
            entity_id: entityId,
            entity_name: entity.name,
            entity_type: 'customer',
            brands: [],
            total_billed: 0,
            total_paid: 0,
            total_outstanding: 0,
            oldest_unpaid_date: null,
            max_days_overdue: 0,
            unpaid_invoice_count: 0,
            risk_level: 'low',
            invoices: [],
            phone: entity.phone,
            email: entity.email,
          };
        }

        const account = accountsMap[entityId];
        account.total_billed += totalAmount;
        account.total_paid += amountPaid;
        account.total_outstanding += balanceDue;
        account.unpaid_invoice_count++;
        account.max_days_overdue = Math.max(account.max_days_overdue, daysOverdue);

        if (!account.oldest_unpaid_date || new Date(inv.created_at) < new Date(account.oldest_unpaid_date)) {
          account.oldest_unpaid_date = inv.created_at;
        }

        account.invoices.push({
          id: inv.id,
          invoice_number: inv.invoice_number || `CRM-${inv.id.slice(0, 8)}`,
          source,
          invoice_date: inv.created_at,
          due_date: inv.due_date,
          days_overdue: daysOverdue,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          balance_due: balanceDue,
          status: inv.status || 'unpaid',
          brand: null,
        });
      });

      // Process wholesale orders
      wholesaleOrders.forEach(order => {
        const entityId = order.wholesaler_id || 'unknown-ws';
        const entity = entityMap[entityId] || { name: 'Unknown Wholesaler', type: 'wholesaler' as EntityType };
        const totalAmount = Number(order.total) || 0;
        const amountPaid = 0;
        const balanceDue = totalAmount;

        if (balanceDue <= 0) return;

        if (!accountsMap[entityId]) {
          accountsMap[entityId] = {
            entity_id: entityId,
            entity_name: entity.name,
            entity_type: 'wholesaler',
            brands: [],
            total_billed: 0,
            total_paid: 0,
            total_outstanding: 0,
            oldest_unpaid_date: null,
            max_days_overdue: 0,
            unpaid_invoice_count: 0,
            risk_level: 'low',
            invoices: [],
            phone: entity.phone,
            email: entity.email,
          };
        }

        const account = accountsMap[entityId];
        account.total_billed += totalAmount;
        account.total_outstanding += balanceDue;
        account.unpaid_invoice_count++;

        if (!account.oldest_unpaid_date || new Date(order.created_at) < new Date(account.oldest_unpaid_date)) {
          account.oldest_unpaid_date = order.created_at;
        }

        account.invoices.push({
          id: order.id,
          invoice_number: `WS-${order.id.slice(0, 8)}`,
          source: 'wholesale',
          invoice_date: order.created_at,
          due_date: null,
          days_overdue: 0,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          balance_due: balanceDue,
          status: order.payment_status || 'unpaid',
          brand: null,
        });
      });

      // Step 5: Calculate risk levels and build final accounts list
      const accounts = Object.values(accountsMap).map(account => ({
        ...account,
        risk_level: calculateRiskLevel(account),
      }));

      // Sort by outstanding amount (highest first)
      accounts.sort((a, b) => b.total_outstanding - a.total_outstanding);

      // Step 6: Calculate KPIs
      const totalInvoiceCount = storeInvoices.length + crmInvoices.length + wholesaleOrders.length;
      let totalDaysOutstanding = 0;
      let invoicesWithDays = 0;

      const kpi: UnpaidAccountsKPI = {
        total_outstanding: 0,
        total_overdue: 0,
        unpaid_invoice_count: 0,
        overdue_invoice_count: 0,
        unique_accounts_count: accounts.length,
        average_days_outstanding: 0,
        by_source: {
          store: { outstanding: 0, count: 0 },
          crm: { outstanding: 0, count: 0 },
          wholesale: { outstanding: 0, count: 0 },
          legacy: { outstanding: 0, count: 0 },
        },
        by_brand: {},
        by_risk: {
          low: { outstanding: 0, count: 0 },
          medium: { outstanding: 0, count: 0 },
          high: { outstanding: 0, count: 0 },
          critical: { outstanding: 0, count: 0 },
        },
      };

      accounts.forEach(account => {
        kpi.total_outstanding += account.total_outstanding;
        kpi.unpaid_invoice_count += account.unpaid_invoice_count;
        
        // Risk breakdown
        kpi.by_risk[account.risk_level].outstanding += account.total_outstanding;
        kpi.by_risk[account.risk_level].count++;

        // Process each invoice
        account.invoices.forEach(inv => {
          // Source breakdown
          kpi.by_source[inv.source].outstanding += inv.balance_due;
          kpi.by_source[inv.source].count++;

          // Brand breakdown
          if (inv.brand) {
            if (!kpi.by_brand[inv.brand]) {
              kpi.by_brand[inv.brand] = { outstanding: 0, count: 0 };
            }
            kpi.by_brand[inv.brand].outstanding += inv.balance_due;
            kpi.by_brand[inv.brand].count++;
          }

          // Overdue tracking
          if (inv.days_overdue > 0) {
            kpi.total_overdue += inv.balance_due;
            kpi.overdue_invoice_count++;
            totalDaysOutstanding += inv.days_overdue;
            invoicesWithDays++;
          }
        });
      });

      kpi.average_days_outstanding = invoicesWithDays > 0 
        ? Math.round(totalDaysOutstanding / invoicesWithDays) 
        : 0;

      // Step 7: Verification
      const verification: UnpaidAccountsVerification = {
        store_unpaid_count: rawCounts.store,
        crm_unpaid_count: rawCounts.crm,
        wholesale_unpaid_count: rawCounts.wholesale,
        total_expected: rawCounts.store + rawCounts.crm + rawCounts.wholesale,
        total_in_view: totalInvoiceCount,
        discrepancy: (rawCounts.store + rawCounts.crm + rawCounts.wholesale) - totalInvoiceCount,
        is_valid: Math.abs((rawCounts.store + rawCounts.crm + rawCounts.wholesale) - totalInvoiceCount) <= 5, // Allow small variance
      };

      if (!verification.is_valid) {
        console.warn('[UnpaidAccounts] ⚠️ DISCREPANCY DETECTED:', verification);
      } else {
        console.log('[UnpaidAccounts] ✓ Verification passed:', verification);
      }

      return {
        accounts,
        kpi,
        verification,
        isLoading: false,
      };
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}
