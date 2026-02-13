import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { subDays, isAfter, differenceInDays } from 'date-fns';

export interface InvoiceLedgerMetrics {
  lifetimeSpend: number;
  spend30: number;
  spend60: number;
  spend90: number;
  orderCount: number;
  avgOrderValue: number;
  openBalance: number;
  trendPercent: number;
  ordersLast30: number;
  recentInvoices: InvoiceLedgerEntry[];
  punctualityRate: number;
  avgDaysToPayment: number;
  latePayments: number;
}

export interface InvoiceLedgerEntry {
  id: string;
  invoice_number: string | null;
  total_amount: number;
  payment_status: string | null;
  created_at: string;
  paid_at: string | null;
  due_date: string | null;
}

export function useInvoiceLedger(entityType: string, entityId: string) {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoice-ledger', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, payment_status, created_at, paid_at, due_date')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!entityType && !!entityId,
  });

  const metrics = useMemo((): InvoiceLedgerMetrics => {
    const now = new Date();
    const day30 = subDays(now, 30);
    const day60 = subDays(now, 60);
    const day90 = subDays(now, 90);

    const paidOrPartial = invoices.filter(
      (inv) => inv.payment_status === 'paid' || inv.payment_status === 'partial'
    );

    const lifetimeSpend = paidOrPartial.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    const spend30 = paidOrPartial
      .filter((inv) => isAfter(new Date(inv.created_at), day30))
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    const spend60 = paidOrPartial
      .filter((inv) => isAfter(new Date(inv.created_at), day60))
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    const spend90 = paidOrPartial
      .filter((inv) => isAfter(new Date(inv.created_at), day90))
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    const orderCount = invoices.length;
    const allTotal = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const avgOrderValue = orderCount > 0 ? allTotal / orderCount : 0;

    const openBalance = invoices
      .filter((inv) => inv.payment_status !== 'paid')
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    // Trend: compare last 30d spend vs previous 30d spend
    const prev30Spend = paidOrPartial
      .filter((inv) => {
        const d = new Date(inv.created_at);
        return isAfter(d, day60) && !isAfter(d, day30);
      })
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    const trendPercent =
      prev30Spend > 0
        ? ((spend30 - prev30Spend) / prev30Spend) * 100
        : spend30 > 0
        ? 100
        : 0;

    const ordersLast30 = invoices.filter((inv) => isAfter(new Date(inv.created_at), day30)).length;

    const recentInvoices: InvoiceLedgerEntry[] = invoices.slice(0, 10).map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      total_amount: Number(inv.total_amount || 0),
      payment_status: inv.payment_status,
      created_at: inv.created_at,
      paid_at: inv.paid_at,
      due_date: inv.due_date,
    }));

    // Payment reliability
    const paidInvoices = invoices.filter((inv) => inv.payment_status === 'paid' && inv.paid_at);
    const onTimeCount = paidInvoices.filter((inv) => {
      if (!inv.due_date || !inv.paid_at) return true;
      return new Date(inv.paid_at) <= new Date(inv.due_date);
    }).length;
    const punctualityRate = paidInvoices.length > 0 ? Math.round((onTimeCount / paidInvoices.length) * 100) : 100;

    const avgDaysToPayment =
      paidInvoices.length > 0
        ? Math.round(
            paidInvoices.reduce((sum, inv) => {
              const invoiceDate = new Date(inv.created_at);
              const paidDate = new Date(inv.paid_at!);
              return sum + Math.max(0, differenceInDays(paidDate, invoiceDate));
            }, 0) / paidInvoices.length
          )
        : 0;

    const latePayments = paidInvoices.filter((inv) => {
      if (!inv.due_date || !inv.paid_at) return false;
      return new Date(inv.paid_at) > new Date(inv.due_date);
    }).length;

    return {
      lifetimeSpend,
      spend30,
      spend60,
      spend90,
      orderCount,
      avgOrderValue,
      openBalance,
      trendPercent,
      ordersLast30,
      recentInvoices,
      punctualityRate,
      avgDaysToPayment,
      latePayments,
    };
  }, [invoices]);

  return { metrics, invoices, isLoading };
}
