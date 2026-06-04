import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, DollarSign } from 'lucide-react';
import { useStorePaymentStatus, type StorePaymentStatus } from '@/hooks/useStorePaymentStatus';

/**
 * StorePaymentBadge — small pill summarizing per-store unpaid balance.
 * Sourced live from invoices (see useStorePaymentStatus). Colors:
 *   green  → paid up
 *   amber  → small balance, fresh
 *   red    → ≥ $200 owed OR oldest unpaid ≥ 14 days
 *
 * Pass a pre-computed `status` to avoid N queries when rendering lists
 * (use useStorePaymentStatusMap once at the parent).
 */
interface Props {
  storeId?: string | null;
  status?: StorePaymentStatus;
  compact?: boolean;
}

const fmt = (n: number) => `$${n.toFixed(0)}`;

export function StorePaymentBadge({ storeId, status, compact }: Props) {
  const fetched = useStorePaymentStatus(status ? null : storeId ?? null);
  const s = status ?? fetched;

  if (s.level === 'paid') {
    if (compact) return null;
    return (
      <Badge
        variant="outline"
        className="gap-1 text-xs bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
        title="Paid up — no outstanding invoices"
      >
        <CheckCircle2 className="h-3 w-3" /> Paid
      </Badge>
    );
  }

  const isRed = s.level === 'red';
  const cls = isRed
    ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 font-bold'
    : 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40 font-semibold';
  const Icon = isRed ? AlertTriangle : DollarSign;
  const ageText = s.oldestUnpaidDays != null ? ` · ${s.oldestUnpaidDays}d` : '';
  const tooltip = `${s.unpaidCount} unpaid invoice${s.unpaidCount === 1 ? '' : 's'} · ${fmt(s.owed)} owed${
    s.oldestUnpaidDays != null ? ` · oldest ${s.oldestUnpaidDays} days` : ''
  }`;

  return (
    <Badge variant="outline" className={`gap-1 text-xs ${cls}`} title={tooltip}>
      <Icon className="h-3 w-3" />
      {fmt(s.owed)} owed{ageText}
    </Badge>
  );
}

/** Returns left-border tint class for a card/row based on payment status. */
export function paymentBorderClass(level: StorePaymentStatus['level']): string {
  if (level === 'red') return 'border-l-4 border-l-red-600';
  if (level === 'amber') return 'border-l-4 border-l-amber-500';
  return '';
}
