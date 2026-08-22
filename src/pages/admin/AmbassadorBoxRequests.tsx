/**
 * AmbassadorBoxRequests — admin queue for ambassador stock requests.
 * Approve creates the purchase (same shape as the admin-initiated flow);
 * decline requires a reason. Shows each ambassador's outstanding balance
 * (unpaid, non-cancelled purchases) so stock isn't released blind.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Package, Check, X, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAllBoxRequests, useReviewBoxRequest, AmbassadorBoxRequest } from '@/hooks/useAmbassadorBoxRequests';

const statusVariant = (s: string) => {
  switch (s) {
    case 'approved': return 'default' as const;
    case 'declined': return 'destructive' as const;
    default: return 'secondary' as const;
  }
};

const money = (n: number) => `$${n.toFixed(2)}`;

export default function AmbassadorBoxRequests() {
  const { data: requests = [], isLoading } = useAllBoxRequests();
  const { approve, decline } = useReviewBoxRequest();
  const [declineTarget, setDeclineTarget] = useState<AmbassadorBoxRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<AmbassadorBoxRequest | null>(null);

  // Outstanding balance per ambassador: unpaid, non-cancelled purchases
  const { data: balances = {} } = useQuery({
    queryKey: ['ambassador-outstanding-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_purchases')
        .select('ambassador_user_id, total, paid_at, status')
        .is('paid_at', null)
        .neq('status', 'cancelled');
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data || []) {
        map[row.ambassador_user_id] = (map[row.ambassador_user_id] || 0) + Number(row.total || 0);
      }
      return map;
    },
  });

  const sorted = useMemo(() => {
    const rank = (s: string) => (s === 'pending' ? 0 : 1);
    return [...requests].sort((a, b) =>
      rank(a.status) - rank(b.status) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [requests]);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const handleApprove = async () => {
    if (!approveTarget) return;
    await approve.mutateAsync(approveTarget);
    setApproveTarget(null);
  };

  const handleDecline = async () => {
    if (!declineTarget) return;
    await decline.mutateAsync({ requestId: declineTarget.id, reason: declineReason });
    setDeclineTarget(null);
    setDeclineReason('');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Ambassador Box Requests
          </h1>
          <p className="text-muted-foreground">
            Review what ambassadors are asking for before stock is released.
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-base px-3 py-1">
            {pendingCount} pending
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Request Queue</CardTitle>
          <CardDescription className="text-xs">
            Approving creates the purchase as a draft order, same as the admin-initiated flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ambassador</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note / Reason</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Loading…</TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No box requests yet.
                  </TableCell>
                </TableRow>
              ) : sorted.map(r => {
                const outstanding = balances[r.ambassador_user_id] || 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.ambassador_name || <span className="font-mono text-xs">{r.ambassador_user_id.slice(0, 8)}…</span>}
                    </TableCell>
                    <TableCell>{r.product_name}</TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className={outstanding > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                      {money(outstanding)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                      {r.status === 'declined' ? (r.decline_reason || '—') : (r.note || '—')}
                    </TableCell>
                    <TableCell>
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setApproveTarget(r)}
                            disabled={approve.isPending}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setDeclineTarget(r); setDeclineReason(''); }}
                            disabled={decline.isPending}
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Approve confirm */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve request</DialogTitle>
            <DialogDescription>
              This creates a draft purchase for {approveTarget?.ambassador_name || 'this ambassador'}:
              {' '}{approveTarget?.quantity} × {approveTarget?.product_name}. Pricing comes from the
              live wholesale price at approval time.
            </DialogDescription>
          </DialogHeader>
          {approveTarget && (balances[approveTarget.ambassador_user_id] || 0) > 0 && (
            <p className="text-sm text-amber-600">
              Heads up: this ambassador currently owes {money(balances[approveTarget.ambassador_user_id])}.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approve.isPending}>
              {approve.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve & Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline with reason */}
      <Dialog open={!!declineTarget} onOpenChange={(o) => !o && setDeclineTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline request</DialogTitle>
            <DialogDescription>
              {declineTarget?.ambassador_name || 'The ambassador'} will see this reason on their request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="Why is this being declined?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={!declineReason.trim() || decline.isPending}
            >
              {decline.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Decline Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
