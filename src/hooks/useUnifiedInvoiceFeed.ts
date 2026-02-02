import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedInvoice {
  id: string;
  invoice_number: string;
  source: 'store' | 'crm' | 'customer';
  entity_id: string | null;
  entity_name: string;
  entity_type: 'store' | 'company' | 'customer';
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
}

export interface InvoiceFilters {
  status?: string;
  source?: 'store' | 'crm' | 'all';
  brand?: string;
  search?: string;
  dateRange?: { start: string; end: string };
  overdueOnly?: boolean;
}

export interface InvoiceStats {
  totalOutstanding: number;
  totalPaid: number;
  overdueCount: number;
  overdueAmount: number;
  invoiceCount: number;
  paidCount: number;
  unpaidCount: number;
}

export function useUnifiedInvoiceFeed(filters?: InvoiceFilters) {
  return useQuery({
    queryKey: ['unified-invoice-feed', filters],
    queryFn: async (): Promise<{ invoices: UnifiedInvoice[]; stats: InvoiceStats }> => {
      const invoices: UnifiedInvoice[] = [];

      // Query store-linked invoices from 'invoices' table
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
          store_master!invoices_store_id_fkey(store_name),
          companies(name)
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
      if (filters?.dateRange) {
        storeQuery = storeQuery
          .gte('created_at', filters.dateRange.start)
          .lte('created_at', filters.dateRange.end);
      }

      const { data: storeInvoices, error: storeError } = await storeQuery;
      if (storeError) console.error('Store invoices error:', storeError);

      // Map store invoices to unified format
      (storeInvoices || []).forEach((inv: any) => {
        const total = Number(inv.total) || Number(inv.total_amount) || 0;
        const paid = Number(inv.amount_paid) || 0;
        const storeName = inv.store_master?.store_name;
        const companyName = inv.companies?.name;

        invoices.push({
          id: inv.id,
          invoice_number: inv.invoice_number || `INV-${inv.id.slice(0, 8).toUpperCase()}`,
          source: 'store',
          entity_id: inv.store_id || inv.company_id,
          entity_name: storeName || companyName || 'Unknown',
          entity_type: inv.store_id ? 'store' : 'company',
          total_amount: total,
          amount_paid: paid,
          balance_due: total - paid,
          status: mapPaymentStatus(inv.payment_status),
          payment_status: inv.payment_status || 'unpaid',
          due_date: inv.due_date,
          created_at: inv.created_at,
          brand: inv.brand,
          receipt_status: inv.receipt_status,
          receipt_sent_at: inv.receipt_sent_at,
          is_historical: inv.is_historical || false,
        });
      });

      // Query CRM customer invoices from 'customer_invoices' table
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
            is_historical,
            crm_customers(name)
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

        const { data: crmInvoices, error: crmError } = await crmQuery;
        if (crmError) console.error('CRM invoices error:', crmError);

        // Map CRM invoices to unified format
        (crmInvoices || []).forEach((inv: any) => {
          const total = Number(inv.total_amount) || 0;
          const status = inv.status || 'draft';
          const customerName = inv.crm_customers?.name;

          invoices.push({
            id: inv.id,
            invoice_number: inv.invoice_number || `CRM-${inv.id.slice(0, 8).toUpperCase()}`,
            source: 'crm',
            entity_id: inv.customer_id,
            entity_name: customerName || 'Unknown Customer',
            entity_type: 'customer',
            total_amount: total,
            amount_paid: status === 'paid' ? total : 0,
            balance_due: status === 'paid' ? 0 : total,
            status: mapCrmStatus(status),
            payment_status: status,
            due_date: inv.due_date,
            created_at: inv.created_at,
            brand: null,
            receipt_status: inv.receipt_status,
            receipt_sent_at: inv.receipt_sent_at,
            is_historical: inv.is_historical || false,
          });
        });
      }

      // Apply search filter
      let filtered = invoices;
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        filtered = invoices.filter(inv =>
          inv.invoice_number.toLowerCase().includes(search) ||
          inv.entity_name.toLowerCase().includes(search)
        );
      }

      // Sort by created_at descending
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Calculate stats
      const now = new Date();
      const stats: InvoiceStats = {
        totalOutstanding: filtered
          .filter(inv => inv.status !== 'paid' && inv.status !== 'void')
          .reduce((sum, inv) => sum + inv.balance_due, 0),
        totalPaid: filtered
          .filter(inv => inv.status === 'paid')
          .reduce((sum, inv) => sum + inv.total_amount, 0),
        overdueCount: filtered.filter(inv => {
          if (inv.status === 'paid' || inv.status === 'void') return false;
          if (!inv.due_date) return false;
          return new Date(inv.due_date) < now;
        }).length,
        overdueAmount: filtered
          .filter(inv => {
            if (inv.status === 'paid' || inv.status === 'void') return false;
            if (!inv.due_date) return false;
            return new Date(inv.due_date) < now;
          })
          .reduce((sum, inv) => sum + inv.balance_due, 0),
        invoiceCount: filtered.length,
        paidCount: filtered.filter(inv => inv.status === 'paid').length,
        unpaidCount: filtered.filter(inv => inv.status !== 'paid' && inv.status !== 'void').length,
      };

      return { invoices: filtered, stats };
    },
    staleTime: 30000,
  });
}

function mapPaymentStatus(status: string): UnifiedInvoice['status'] {
  switch (status?.toLowerCase()) {
    case 'paid': return 'paid';
    case 'partial': return 'partial';
    case 'overdue': return 'overdue';
    case 'unpaid': return 'unpaid';
    case 'void': return 'void';
    case 'sent': return 'sent';
    case 'draft': return 'draft';
    default: return 'unpaid';
  }
}

function mapCrmStatus(status: string): UnifiedInvoice['status'] {
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

// AR Aging hook
export function useARAgingBuckets() {
  const { data } = useUnifiedInvoiceFeed({ status: 'all' });

  const buckets = {
    current: { count: 0, amount: 0 },
    '1-7': { count: 0, amount: 0 },
    '8-14': { count: 0, amount: 0 },
    '15-30': { count: 0, amount: 0 },
    '31-60': { count: 0, amount: 0 },
    '60+': { count: 0, amount: 0 },
  };

  if (!data?.invoices) return buckets;

  const now = new Date();
  data.invoices
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
