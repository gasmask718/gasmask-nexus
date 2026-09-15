// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT ACTIVITY — operational activity across every account.
// Single source: public.v_store_activity (no second activity system).
// ═══════════════════════════════════════════════════════════════════════════════

import { AccountActivityTable } from '@/components/activity/AccountActivityTable';
import { PendingFieldReviewQueue } from '@/components/activity/PendingFieldReviewQueue';

export default function AccountActivity() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Activity</h1>
        <p className="text-sm text-muted-foreground">
          Everything the system already recorded against an exact account — reviews, notes, calls,
          texts, deliveries, routes, orders, samples, follow-ups, inventory, invoices, secured
          stores and status changes.
        </p>
      </div>
      <PendingFieldReviewQueue />
      <AccountActivityTable title="All account activity" defaultPageSize={25} showFieldFilters />
    </div>
  );
}
