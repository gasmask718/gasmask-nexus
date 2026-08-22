/**
 * AmbassadorReferralQueue — owner approval queue for ambassador referrals.
 *
 * Recruits who self-submitted through an ambassador's referral link land here
 * as PENDING. Approve creates the invite (stamped with the referrer's
 * ambassador id so attribution survives) and delivers it by SMS + email.
 * Decline requires a reason; the owner chooses whether the referrer sees it.
 *
 * Bottom section: referral tree — for any ambassador, who referred them and
 * who they have referred, plus their referral conversion stats.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Check, X, Loader2, GitBranch, ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  useAllReferrals,
  useReviewReferral,
  useReferralTree,
  referralStatsByAmbassador,
  AmbassadorReferralWithNames,
} from '@/hooks/useAmbassadorReferrals';

const statusVariant = (s: string) => {
  switch (s) {
    case 'approved': return 'default' as const;
    case 'declined': return 'destructive' as const;
    default: return 'secondary' as const;
  }
};

export default function AmbassadorReferralQueue() {
  const { data: referrals = [], isLoading } = useAllReferrals();
  const { data: tree = [], isLoading: treeLoading } = useReferralTree();
  const review = useReviewReferral();

  const [declineTarget, setDeclineTarget] = useState<AmbassadorReferralWithNames | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [showReason, setShowReason] = useState(true);
  const [approveTarget, setApproveTarget] = useState<AmbassadorReferralWithNames | null>(null);
  const [treeSelection, setTreeSelection] = useState<string>('');

  const stats = useMemo(() => referralStatsByAmbassador(referrals), [referrals]);

  const sorted = useMemo(() => {
    const rank = (s: string) => (s === 'pending' ? 0 : 1);
    return [...referrals].sort((a, b) =>
      rank(a.status) - rank(b.status) ||
      // pending: oldest first (FIFO review); reviewed: newest first
      (a.status === 'pending'
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    );
  }, [referrals]);

  const pendingCount = referrals.filter(r => r.status === 'pending').length;

  const handleApprove = async () => {
    if (!approveTarget) return;
    await review.mutateAsync({ request: approveTarget, decision: 'approve' });
    setApproveTarget(null);
  };

  const handleDecline = async () => {
    if (!declineTarget || !declineReason.trim()) return;
    await review.mutateAsync({
      request: declineTarget,
      decision: 'decline',
      reason: declineReason.trim(),
      showReason,
    });
    setDeclineTarget(null);
    setDeclineReason('');
    setShowReason(true);
  };

  // Referral tree helpers
  const treeById = useMemo(() => Object.fromEntries(tree.map(n => [n.id, n])), [tree]);
  const selectedNode = treeSelection ? treeById[treeSelection] : null;
  const selectedRecruiter = selectedNode?.recruited_by_ambassador_id
    ? treeById[selectedNode.recruited_by_ambassador_id]
    : null;
  const selectedRecruits = useMemo(
    () => (treeSelection ? tree.filter(n => n.recruited_by_ambassador_id === treeSelection) : []),
    [tree, treeSelection],
  );
  const selectedStats = treeSelection ? stats[treeSelection] : undefined;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Ambassador Referral Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Recruits who applied through an ambassador's referral link. Approval sends the invite by text and email.
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-sm">{pendingCount} pending</Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Referral requests</CardTitle>
          <CardDescription>
            Pending referrals first (oldest waiting longest). Approving creates + delivers the invite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No referrals yet. They appear here when someone signs up through an ambassador's link.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recruit</TableHead>
                  <TableHead>Referred by</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(r => {
                  const s = stats[r.referrer_ambassador_id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.full_name}</span>
                          {r.region && <span className="text-xs text-muted-foreground">{r.region}</span>}
                          {r.notes && (
                            <span className="text-xs text-muted-foreground/80 italic max-w-[240px] truncate" title={r.notes}>
                              “{r.notes}”
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{r.referrer_name || 'Unknown'}</span>
                          {s && (
                            <span className="text-xs text-muted-foreground">
                              {s.total} referred · {s.approved} approved
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          {r.phone && <span>{r.phone}</span>}
                          {r.email && <span className="text-muted-foreground">{r.email}</span>}
                          {!r.phone && !r.email && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={statusVariant(r.status)} className="w-fit">{r.status}</Badge>
                          {r.status === 'approved' && r.resulting_ambassador_name && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <ArrowUpRight className="h-3 w-3" />Now: {r.resulting_ambassador_name}
                            </span>
                          )}
                          {r.status === 'declined' && r.decline_reason && (
                            <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.decline_reason}>
                              {r.decline_reason}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setApproveTarget(r)}>
                              <Check className="h-4 w-4 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeclineTarget(r)}>
                              <X className="h-4 w-4 mr-1" />Decline
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {r.reviewed_at ? format(new Date(r.reviewed_at), 'MMM d, yyyy') : ''}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Referral tree */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Referral tree
          </CardTitle>
          <CardDescription>
            Pick an ambassador to see who brought them in and who they have brought in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {treeLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <Select value={treeSelection} onValueChange={setTreeSelection}>
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder="Select an ambassador…" />
                </SelectTrigger>
                <SelectContent>
                  {tree.map(n => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name || '(unnamed)'} {n.tracking_code ? `· ${n.tracking_code}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedNode && (
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Referred by</p>
                    {selectedRecruiter ? (
                      <p className="text-sm font-medium">{selectedRecruiter.name || '(unnamed)'}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Direct / no referrer on record</p>
                    )}
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Referral stats</p>
                    <p className="text-sm font-medium">
                      {selectedStats ? `${selectedStats.total} referred · ${selectedStats.approved} approved` : 'No link referrals yet'}
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Ambassadors brought in ({selectedRecruits.length})</p>
                    {selectedRecruits.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None yet</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {selectedRecruits.map(r => (
                          <li key={r.id} className="flex justify-between gap-2">
                            <span className="truncate">{r.name || '(unnamed)'}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(r.created_at), 'MMM d, yyyy')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Approve dialog */}
      <Dialog open={!!approveTarget} onOpenChange={() => setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve referral</DialogTitle>
            <DialogDescription>
              This creates an ambassador invite for <strong>{approveTarget?.full_name}</strong> and sends it by
              text and email. Credit goes to <strong>{approveTarget?.referrer_name || 'the referrer'}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-1">
            {approveTarget?.phone && <p>📱 {approveTarget.phone}</p>}
            {approveTarget?.email && <p>✉️ {approveTarget.email}</p>}
            {!approveTarget?.phone && !approveTarget?.email && (
              <p className="text-destructive">No contact details on this referral — the invite cannot be delivered.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={review.isPending || (!approveTarget?.phone && !approveTarget?.email)}>
              {review.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve & send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline dialog */}
      <Dialog open={!!declineTarget} onOpenChange={() => setDeclineTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline referral</DialogTitle>
            <DialogDescription>
              Decline <strong>{declineTarget?.full_name}</strong> (referred by {declineTarget?.referrer_name || 'unknown'}).
              A reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="Why is this referral being declined?"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-reason"
                checked={showReason}
                onCheckedChange={v => setShowReason(v === true)}
              />
              <Label htmlFor="show-reason" className="text-sm font-normal">
                Show this reason to the referring ambassador
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline} disabled={review.isPending || !declineReason.trim()}>
              {review.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Decline referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
