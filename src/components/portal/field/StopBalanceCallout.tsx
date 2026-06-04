import { AlertCircle } from 'lucide-react';
import { useStorePaymentStatus } from '@/hooks/useStorePaymentStatus';
import { MarkCollectedButton } from './MarkCollectedButton';

/**
 * Compact red/amber bar appended to each driver/biker stop card so a rep
 * sees "this store owes $X" before knocking, with one-tap Mark Collected.
 */
export function StopBalanceCallout({
  storeId,
  storeName,
}: {
  storeId: string;
  storeName?: string;
}) {
  const status = useStorePaymentStatus(storeId);
  if (status.level === 'paid' || status.owed <= 0) return null;

  const isRed = status.level === 'red';
  const tone = isRed
    ? 'border-destructive bg-destructive/10 text-destructive'
    : 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400';

  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-md border-l-4 ${tone} px-2 py-2`}
      onClick={(e) => e.stopPropagation()}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0 text-xs">
        <p className="font-bold leading-tight">
          OWES ${status.owed.toFixed(2)}
          {status.oldestUnpaidDays != null && status.oldestUnpaidDays > 0
            ? ` • ${status.oldestUnpaidDays}d old`
            : ''}
        </p>
        <p className="opacity-80">Collect on this visit</p>
      </div>
      <MarkCollectedButton
        storeId={storeId}
        storeName={storeName}
        defaultAmount={status.owed}
        size="sm"
        variant={isRed ? 'destructive' : 'default'}
      />
    </div>
  );
}
