/**
 * Shared row-style helper for invoice datatables.
 * Surfaces a consistent paid/unpaid/overdue color across every invoice table.
 *
 *   paid    → green tint
 *   unpaid  → amber tint (fresh)
 *   overdue → red tint (past due_date OR payment_status === 'overdue')
 *
 * Overdue rule: invoice.due_date is present and < today, and not paid.
 * If due_date is null, falls back to oldest 14d threshold like StorePaymentBadge.
 */
export type InvoicePaymentLevel = 'paid' | 'unpaid' | 'overdue';

export interface InvoiceRowLike {
  payment_status?: string | null;
  due_date?: string | null;
  finalized_at?: string | null;
  created_at?: string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
  amount_paid?: number | string | null;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

export function classifyInvoice(inv: InvoiceRowLike): InvoicePaymentLevel {
  const status = (inv.payment_status ?? '').toLowerCase();
  if (status === 'paid') return 'paid';
  const total = num(inv.total) || num(inv.total_amount);
  const paid = num(inv.amount_paid);
  if (total > 0 && paid >= total) return 'paid';
  if (status === 'overdue') return 'overdue';
  const due = inv.due_date ? new Date(inv.due_date) : null;
  if (due && !isNaN(due.getTime()) && due.getTime() < Date.now()) return 'overdue';
  // Fallback: if no due_date but invoice is >= 30d old & unpaid → overdue
  const anchor = inv.finalized_at ?? inv.created_at;
  if (anchor) {
    const age = (Date.now() - new Date(anchor).getTime()) / 86_400_000;
    if (age >= 30) return 'overdue';
  }
  return 'unpaid';
}

export const INVOICE_ROW_CLASS: Record<InvoicePaymentLevel, string> = {
  paid: 'bg-green-500/5 hover:bg-green-500/10',
  unpaid: 'bg-amber-500/10 hover:bg-amber-500/15 font-medium',
  overdue: 'bg-red-500/15 hover:bg-red-500/20 font-bold text-red-700 dark:text-red-300',
};

export const INVOICE_BADGE_CLASS: Record<InvoicePaymentLevel, string> = {
  paid: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
  unpaid: 'bg-amber-500/15 text-amber-700 dark:text-amber-200 border-amber-500/30',
  overdue: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40',
};

export function invoiceRowClass(inv: InvoiceRowLike): string {
  return INVOICE_ROW_CLASS[classifyInvoice(inv)];
}
