/**
 * AmbassadorRequests — Owner/admin review queue for ambassador expansion.
 * Security & Governance > Ambassador Requests.
 *
 * One queue for both origins: ambassador-entered requests and public
 * referral-link signups (source column on ambassador_invite_requests).
 * Approve creates the invite with the referrer's attribution
 * (invited_by_ambassador_id), stamps owner_approved_at/by, and delivers it
 * by text + email. Reject requires a reason; the owner chooses whether the
 * ambassador sees it.
 *
 * Bottom section: referral tree — for any ambassador, who referred them and
 * who they have brought in.
 */
import { useMemo, useState } from 'react';
import {
  UserPlus, CheckCircle, XCircle, Clock, Mail, MapPin, Shield, Phone, Link2, GitBranch,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAllRequests, useApproveRequest, useRejectRequest, type AmbassadorRequest } from '@/hooks/useAmbassadorRequests';
import { referralStatsByAmbassador, useReferralTree } from '@/hooks/useAmbassadorReferrals';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'secondary' as const },
  approved: { label: 'Approved', variant: 'default' as const },
  rejected: { label: 'Rejected', variant: 'destructive' as const },
};

function ReferralTreeSection() {
  const { data: tree = [], isLoading } = useReferralTree();
  const [selectedId, setSelectedId] = useState<string>('');

  const byId = useMemo(() => Object.fromEntries(tree.map(n => [n.id, n])), [tree]);
  const selected = selectedId ? byId[selectedId] : null;
  const recruits = useMemo(
    () => (selectedId ? tree.filter(n => n.recruited_by_ambassador_id === selectedId) : []),
    [tree, selectedId],
  );
  const referrer = selected?.recruited_by_ambassador_id ? byId[selected.recruited_by_ambassador_id] : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          Referral Tree
        </CardTitle>
        <CardDescription className="text-xs">
          Who brought each ambassador in, and who they have brought in. Attribution rides
          recruited_by_ambassador_id, stamped at invite acceptance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full sm:w-96">
                <SelectValue placeholder="Pick an ambassador…" />
              </SelectTrigger>
              <SelectContent>
                {tree.map(n => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name || '(unnamed)'}{n.tracking_code ? ` — ${n.tracking_code}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-muted/40 rounded-lg p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Referred by</p>
                  <p>{referrer ? referrer.name || '(unnamed)' : '— nobody (direct or pre-attribution)'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Has brought in ({recruits.length})
                  </p>
                  {recruits.length === 0 ? (
                    <p className="text-muted-foreground">No recruits yet</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {recruits.map(r => (
                        <li key={r.id}>{r.name || '(unnamed)'}</li>
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
  );
}

export default function AmbassadorRequests() {
  const { data: requests = [], isLoading } = useAllRequests();
  const { data: tree = [] } = useReferralTree();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<AmbassadorRequest | null>(null);
  const [approveTarget, setApproveTarget] = useState<AmbassadorRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AmbassadorRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectShowNotes, setRejectShowNotes] = useState(true);
  const [approveNotes, setApproveNotes] = useState('');

  const ambassadorNames = useMemo(
    () => Object.fromEntries(tree.map(n => [n.id, n.name || '(unnamed)'])),
    [tree],
  );
  const stats = useMemo(() => referralStatsByAmbassador(requests as any), [requests]);

  const filtered = requests.filter(r => statusFilter === 'all' || r.status === statusFilter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const referrerLine = (req: AmbassadorRequest) => {
    if (!req.requested_by_ambassador_id) return null;
    const s = stats[req.requested_by_ambassador_id];
    const name = ambassadorNames[req.requested_by_ambassador_id] || 'Unknown';
    return s ? `${name} · ${s.total} referred, ${s.approved} approved` : name;
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    await approveRequest.mutateAsync({ request: approveTarget, notes: approveNotes || undefined });
    setApproveTarget(null);
    setApproveNotes('');
    setSelectedRequest(null);
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectNotes.trim()) return;
    await rejectRequest.mutateAsync({ requestId: rejectTarget.id, notes: rejectNotes, showNotes: rejectShowNotes });
    setRejectTarget(null);
    setRejectNotes('');
    setRejectShowNotes(true);
    setSelectedRequest(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Ambassador Requests & Referrals
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2">{pendingCount} pending</Badge>
          )}
        </h1>
        <p className="text-muted-foreground mt-1">
          One queue: requests ambassadors enter themselves, and signups from their public referral links.
          Approving creates the invite with the referrer's credit and sends it by text and email.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({requests.length})</SelectItem>
            <SelectItem value="pending">Pending ({requests.filter(r => r.status === 'pending').length})</SelectItem>
            <SelectItem value="approved">Approved ({requests.filter(r => r.status === 'approved').length})</SelectItem>
            <SelectItem value="rejected">Rejected ({requests.filter(r => r.status === 'rejected').length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recruit</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Referred by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No requests match your filter.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(req => {
                  const config = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                  return (
                    <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRequest(req)}>
                      <TableCell className="font-medium">{req.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-col">
                          {req.email && (
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{req.email}</span>
                          )}
                          {req.phone && (
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{req.phone}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{req.territory || '—'}</TableCell>
                      <TableCell>
                        {req.source === 'public_referral' ? (
                          <Badge variant="outline" className="gap-1 text-xs"><Link2 className="h-3 w-3" />Referral link</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs"><UserPlus className="h-3 w-3" />Ambassador</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {referrerLine(req) || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {req.status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="default" onClick={() => setApproveTarget(req)}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setRejectTarget(req)}>
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <ReferralTreeSection />

      {/* Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={v => { if (!v) setSelectedRequest(null); }}>
        <DialogContent className="max-w-lg">
          {selectedRequest && (() => {
            const config = STATUS_CONFIG[selectedRequest.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedRequest.full_name}
                    <Badge variant={config.variant}>{config.label}</Badge>
                    {selectedRequest.source === 'public_referral' && (
                      <Badge variant="outline" className="gap-1 text-xs"><Link2 className="h-3 w-3" />Referral link</Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    Submitted {format(new Date(selectedRequest.created_at), 'PPP')}
                    {referrerLine(selectedRequest) ? ` · Referred by ${referrerLine(selectedRequest)}` : ''}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedRequest.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedRequest.email}</span>
                      </div>
                    )}
                    {selectedRequest.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedRequest.phone}</span>
                      </div>
                    )}
                    {selectedRequest.territory && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedRequest.territory}</span>
                      </div>
                    )}
                  </div>

                  {selectedRequest.justification && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {selectedRequest.source === 'public_referral' ? 'What they told us' : 'Justification'}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{selectedRequest.justification}</p>
                    </div>
                  )}

                  {selectedRequest.review_notes && (
                    <div className={`rounded-lg p-3 ${selectedRequest.status === 'approved' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Review Notes{selectedRequest.status === 'rejected' && !selectedRequest.show_review_notes ? ' (hidden from ambassador)' : ''}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{selectedRequest.review_notes}</p>
                    </div>
                  )}

                  {selectedRequest.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" onClick={() => { setApproveTarget(selectedRequest); }}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={() => { setRejectTarget(selectedRequest); }}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog open={!!approveTarget} onOpenChange={v => { if (!v) { setApproveTarget(null); setApproveNotes(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Ambassador Request</AlertDialogTitle>
            <AlertDialogDescription>
              This creates a secure invite for <strong>{approveTarget?.full_name}</strong> with the referrer's
              credit attached, stamps your approval, and sends the link
              {approveTarget?.phone && approveTarget?.email ? ' by text and email'
                : approveTarget?.phone ? ' by text'
                : ' by email'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any notes about this approval..."
              value={approveNotes}
              onChange={e => setApproveNotes(e.target.value)}
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approveRequest.isPending}>
              {approveRequest.isPending ? 'Approving...' : 'Approve & Send Invite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={v => { if (!v) { setRejectTarget(null); setRejectNotes(''); setRejectShowNotes(true); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Ambassador Request</AlertDialogTitle>
            <AlertDialogDescription>
              Rejecting request for <strong>{rejectTarget?.full_name}</strong>. A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Why is this request being rejected?"
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="reject-show-notes"
                checked={rejectShowNotes}
                onCheckedChange={(c) => setRejectShowNotes(c === true)}
              />
              <Label htmlFor="reject-show-notes" className="text-sm font-normal">
                Let the referring ambassador see this reason
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectRequest.isPending || !rejectNotes.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectRequest.isPending ? 'Rejecting...' : 'Reject Request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
