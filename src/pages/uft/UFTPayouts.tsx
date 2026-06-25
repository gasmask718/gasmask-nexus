import { Banknote } from 'lucide-react';
import PayoutRequestsPanel from '@/components/uft/PayoutRequestsPanel';

export default function UFTPayouts() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Banknote className="h-7 w-7 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold">Ambassador Payout Requests</h1>
          <p className="text-sm text-muted-foreground">Approve, process, and pay out ambassador commissions</p>
        </div>
      </div>
      <PayoutRequestsPanel />
    </div>
  );
}
