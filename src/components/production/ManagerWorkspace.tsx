/**
 * OFFICE MANAGER WORKSPACE — one screen, top to bottom, in work order:
 *   Today (what we made / what we used / defects / notes / close the day)
 *   Materials received (confirm what HQ sent)
 *   Tools at my office (+ report a problem)
 *   Sending back to HQ (returns)
 *   My previous days
 * Everything is scoped to the manager's own office by RLS. No admin controls,
 * no costs, no other office.
 */

import { OfficeLeaderToday } from '@/components/production/OfficeLeaderToday';
import { ShipmentsPanel } from '@/components/production/ShipmentsPanel';
import { ManagerToolsPanel } from '@/components/production/ManagerToolsPanel';
import { OfficeReturnsPanel } from '@/components/production/OfficeReturnsPanel';
import { ManagerPreviousDays } from '@/components/production/ManagerPreviousDays';

export function ManagerWorkspace({ officeId, officeName }: { officeId: string; officeName: string }) {
  return (
    <div className="space-y-6">
      <OfficeLeaderToday officeId={officeId} officeName={officeName} />
      <ShipmentsPanel officeId={officeId} />
      <ManagerToolsPanel officeId={officeId} />
      <OfficeReturnsPanel officeId={officeId} mode="manager" />
      <ManagerPreviousDays officeId={officeId} />
    </div>
  );
}
