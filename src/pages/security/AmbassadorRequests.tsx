/**
 * AmbassadorRequests — Admin review interface for ambassador expansion requests
 * Security & Governance > Ambassador Requests
 */
import { useState } from 'react';
import {
  UserPlus, CheckCircle, XCircle, Clock, Mail, MapPin, FileText, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAllRequests, useApproveRequest, useRejectRequest, type AmbassadorRequest } from '@/hooks/useAmbassadorRequests';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  approved: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
};

export default function AmbassadorRequests() {
  const { data: requests = [], isLoading } = useAllRequests();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<AmbassadorRequest | null>(null);
  const [approveTarget, setApproveTarget] = useState<AmbassadorRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AmbassadorRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [approveNotes, setApproveNotes] = useState('');

  const filtered = requests.filter(r => statusFilter === 'all' || r.status === statusFilter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const handleApprove = async () => {
    if (!approveTarget) return;
    await approveRequest.mutateAsync({ requestId: approveTarget.id, notes: approveNotes || undefined });
    setApproveTarget(null);
    setApproveNotes('');
    setSelectedRequest(null);
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectNotes.trim()) return;
    await rejectRequest.mutateAsync({ requestId: rejectTarget.id, notes: rejectNotes });
    setRejectTarget(null);
    setRejectNotes('');
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
          Ambassador Requests
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2">{pendingCount} pending</Badge>
          )}
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and approve ambassador expansion requests submitted by field ambassadors.
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
                  <TableHead>Recommended Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No requests match your filter.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(req => {
                  const config = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
                  return (
                    <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRequest(req)}>
                      <TableCell className="font-medium">{req.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{req.email}</TableCell>
                      <TableCell className="text-sm">{req.territory || '—'}</TableCell>
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={v => { if (!v) setSelectedRequest(null); }}>
        <DialogContent className="max-w-lg">
          {selectedRequest && (() => {
            const config = STATUS_CONFIG[selectedRequest.status as keyof typeof STATUS_CONFIG];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedRequest.full_name}
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </DialogTitle>
                  <DialogDescription>
                    Submitted {format(new Date(selectedRequest.created_at), 'PPP')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedRequest.email}</span>
                    </div>
                    {selectedRequest.territory && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedRequest.territory}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Justification</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedRequest.justification}</p>
                  </div>

                  {selectedRequest.review_notes && (
                    <div className={`rounded-lg p-3 ${selectedRequest.status === 'approved' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Review Notes</p>
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
              This will generate a secure invite for <strong>{approveTarget?.full_name}</strong> ({approveTarget?.email}).
              The invite will be created through the governed invite system.
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
              {approveRequest.isPending ? 'Approving...' : 'Approve & Generate Invite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={v => { if (!v) { setRejectTarget(null); setRejectNotes(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Ambassador Request</AlertDialogTitle>
            <AlertDialogDescription>
              Rejecting request for <strong>{rejectTarget?.full_name}</strong>. A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Why is this request being rejected?"
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              rows={3}
            />
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
