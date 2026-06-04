import { AlertCircle } from 'lucide-react';
import { useStorePaymentStatus } from '@/hooks/useStorePaymentStatus';
import { MarkCollectedButton } from '@/components/portal/field/MarkCollectedButton';

/**
 * Prominent red/amber banner shown on /stores/:id when the store has an
 * outstanding balance. Built for field reps walking into a store — first
 * thing they see. Includes inline "Mark Collected" so the rep can record
 * a cash/check pickup without leaving the page.
 */
export function StoreBalanceBanner({ storeId, storeName }: { storeId: string; storeName?: string }) {
  const status = useStorePaymentStatus(storeId);
  if (status.level === 'paid' || status.owed <= 0) return null;

  const isRed = status.level === 'red';
  const tone = isRed
    ? 'border-destructive bg-destructive/10 text-destructive'
    : 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  const dot = isRed ? 'bg-destructive' : 'bg-amber-500';

  return (
    <div
      role="alert"
      className={`relative flex flex-wrap items-center gap-3 rounded-lg border-2 ${tone} px-4 py-3 shadow-sm`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${dot} rounded-l`} />
      <AlertCircle className="h-5 w-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-base leading-tight">
          OUTSTANDING BALANCE — ${status.owed.toFixed(2)}
        </p>
        <p className="text-sm opacity-90">
          {status.unpaidCount} unpaid invoice{status.unpaidCount === 1 ? '' : 's'}
          {status.oldestUnpaidDays != null && status.oldestUnpaidDays > 0
            ? ` • oldest ${status.oldestUnpaidDays}d`
            : ''}
          {' • collect on this visit'}
        </p>
      </div>
      <MarkCollectedButton
        storeId={storeId}
        storeName={storeName}
        defaultAmount={status.owed}
      />
    </div>
  );
}
