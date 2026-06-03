/**
 * SUBMISSION APPROVAL QUEUE
 * 
 * Manager-facing component in Manufacturing OS.
 * Shows pending worker submissions with approve/reject actions.
 * Approved submissions auto-create batch outputs.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  CheckCircle, XCircle, Clock, ClipboardList, Loader2, 
  CheckCheck, Eye, AlertTriangle 
} from 'lucide-react';
import { 
  useWorkerSubmissions, 
  useReviewSubmission, 
  useBulkApproveSubmissions,
  type WorkerSubmission 
} from '@/hooks/useWorkerSubmissions';
import { format } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';

interface SubmissionApprovalQueueProps {
  officeId: string;
}

const STATUS_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending_review: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
  approved: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  rejected: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  auto_approved: { variant: 'secondary', icon: <CheckCheck className="h-3 w-3" /> },
};

export function SubmissionApprovalQueue({ officeId }: SubmissionApprovalQueueProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('pending_review');
  const [selectedSubmission, setSelectedSubmission] = useState<WorkerSubmission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: submissions = [], isLoading } = useWorkerSubmissions(
    officeId, 
    activeTab === 'all' ? undefined : activeTab
  );
  const reviewSubmission = useReviewSubmission();
  const bulkApprove = useBulkApproveSubmissions();

  const handleReview = (decision: 'approved' | 'rejected') => {
    if (!selectedSubmission) return;
    reviewSubmission.mutate({
      submissionId: selectedSubmission.id,
      decision,
      reviewNotes,
      officeId,
    }, {
      onSuccess: () => {
        setSelectedSubmission(null);
        setReviewNotes('');
      },
    });
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    bulkApprove.mutate({ submissionIds: selectedIds, officeId }, {
      onSuccess: () => setSelectedIds([]),
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const pendingCount = submissions.filter(s => s.status === 'pending_review').length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <BilingualLabel tKey="production.worker_submissions" en="Worker Submissions" />
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pendingCount} {t('production.pending_suffix')}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                <BilingualLabel
                  tKey="production.review_inventory_desc"
                  en="Review and approve worker production logs before they update inventory."
                />
              </CardDescription>
            </div>
            {selectedIds.length > 0 && activeTab === 'pending_review' && (
              <Button 
                onClick={handleBulkApprove}
                disabled={bulkApprove.isPending}
                size="sm"
              >
                {bulkApprove.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCheck className="h-4 w-4 mr-1" />
                )}
                {t('production.approve_selected')} {selectedIds.length} {t('production.selected_suffix')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending_review" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <BilingualLabel tKey="production.pending" en="Pending" inline />
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{pendingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">
                <BilingualLabel tKey="production.tab_approved" en="Approved" inline />
              </TabsTrigger>
              <TabsTrigger value="rejected">
                <BilingualLabel tKey="production.tab_rejected" en="Rejected" inline />
              </TabsTrigger>
              <TabsTrigger value="all">
                <BilingualLabel tKey="production.tab_all" en="All" inline />
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>
                    {t('production.no_submissions_prefix')} {activeTab === 'all' ? '' : activeTab.replace('_', ' ')} {t('production.submissions_suffix')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {activeTab === 'pending_review' && (
                          <TableHead className="w-8">
                            <input
                              type="checkbox"
                              checked={selectedIds.length === submissions.length && submissions.length > 0}
                              onChange={() => {
                                setSelectedIds(
                                  selectedIds.length === submissions.length
                                    ? []
                                    : submissions.map(s => s.id)
                                );
                              }}
                              className="rounded border-input"
                            />
                          </TableHead>
                        )}
                        <TableHead><BilingualLabel tKey="production.worker" en="Worker" /></TableHead>
                        <TableHead><BilingualLabel tKey="production.batch" en="Batch" /></TableHead>
                        <TableHead className="text-right"><BilingualLabel tKey="production.lbs" en="Lbs" /></TableHead>
                        <TableHead className="text-right"><BilingualLabel tKey="production.tubes" en="Tubes" /></TableHead>
                        <TableHead className="text-right"><BilingualLabel tKey="production.boxes" en="Boxes" /></TableHead>
                        <TableHead className="text-right"><BilingualLabel tKey="production.defects" en="Defects" /></TableHead>
                        <TableHead><BilingualLabel tKey="production.status_header" en="Status" /></TableHead>
                        <TableHead><BilingualLabel tKey="production.submitted_header" en="Submitted" /></TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((sub) => {
                        const badge = STATUS_BADGES[sub.status] || STATUS_BADGES.pending_review;
                        return (
                          <TableRow key={sub.id} className={sub.status === 'pending_review' ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                            {activeTab === 'pending_review' && (
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(sub.id)}
                                  onChange={() => toggleSelection(sub.id)}
                                  className="rounded border-input"
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium">
                              {sub.worker?.full_name || t('production.unknown')}
                              <span className="block text-xs text-muted-foreground">
                                {sub.worker?.role || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm">{sub.batch?.brand || '—'}</span>
                            </TableCell>
                            <TableCell className="text-right">{sub.lbs_processed}</TableCell>
                            <TableCell className="text-right">{sub.tubes_produced}</TableCell>
                            <TableCell className="text-right font-medium">{sub.boxes_packed}</TableCell>
                            <TableCell className="text-right">
                              {sub.defects_count > 0 ? (
                                <span className="text-destructive font-medium flex items-center justify-end gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {sub.defects_count}
                                </span>
                              ) : '0'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={badge.variant} className="flex items-center gap-1 w-fit">
                                {badge.icon}
                                {sub.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(sub.created_at), 'h:mm a')}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedSubmission(sub);
                                  setReviewNotes('');
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <BilingualLabel tKey="production.review_submission" en="Review Submission" />
            </DialogTitle>
            <DialogDescription>
              {selectedSubmission?.worker?.full_name || t('production.worker')} — {selectedSubmission?.batch?.brand || t('production.batch_fallback')}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4">
              {/* Summary Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    <BilingualLabel tKey="production.lbs" en="Lbs" />
                  </p>
                  <p className="text-lg font-bold">{selectedSubmission.lbs_processed}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    <BilingualLabel tKey="production.tubes" en="Tubes" />
                  </p>
                  <p className="text-lg font-bold">{selectedSubmission.tubes_produced}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    <BilingualLabel tKey="production.boxes" en="Boxes" />
                  </p>
                  <p className="text-lg font-bold">{selectedSubmission.boxes_packed}</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    <BilingualLabel tKey="production.defects" en="Defects" inline />
                  </span>
                  <span className={selectedSubmission.defects_count > 0 ? 'text-destructive font-medium' : ''}>
                    {selectedSubmission.defects_count}
                    {selectedSubmission.defect_reason && ` — ${selectedSubmission.defect_reason}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    <BilingualLabel tKey="production.waste" en="Waste" inline />
                  </span>
                  <span>{selectedSubmission.waste_lbs} {t('production.lbs')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    <BilingualLabel tKey="production.downtime" en="Downtime" inline />
                  </span>
                  <span>
                    {selectedSubmission.downtime_minutes} {t('production.min_unit')}
                    {selectedSubmission.downtime_reason && ` — ${selectedSubmission.downtime_reason}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    <BilingualLabel tKey="production.qc" en="QC" inline />
                  </span>
                  <Badge variant={selectedSubmission.quality_check_passed ? 'default' : 'destructive'}>
                    {selectedSubmission.quality_check_passed
                      ? t('production.passed')
                      : t('production.failed')}
                  </Badge>
                </div>
                {selectedSubmission.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground mb-1">
                      <BilingualLabel tKey="production.worker_notes" en="Worker Notes:" />
                    </p>
                    <p className="bg-muted/50 rounded p-2">{selectedSubmission.notes}</p>
                  </div>
                )}
              </div>

              {/* Review Notes */}
              {selectedSubmission.status === 'pending_review' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    <BilingualLabel tKey="production.review_notes_optional" en="Review Notes (optional)" />
                  </label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={t('production.review_notes_placeholder')}
                    rows={2}
                  />
                </div>
              )}

              {/* Review result display */}
              {selectedSubmission.status !== 'pending_review' && selectedSubmission.review_notes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">
                    <BilingualLabel tKey="production.review_notes_label" en="Review Notes:" />
                  </p>
                  <p className="text-sm bg-muted/50 rounded p-2">{selectedSubmission.review_notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedSubmission?.status === 'pending_review' ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleReview('rejected')}
                  disabled={reviewSubmission.isPending}
                >
                  {reviewSubmission.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  <BilingualLabel tKey="production.reject" en="Reject" inline />
                </Button>
                <Button
                  onClick={() => handleReview('approved')}
                  disabled={reviewSubmission.isPending}
                >
                  {reviewSubmission.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  <BilingualLabel tKey="production.approve" en="Approve" inline />
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                <BilingualLabel tKey="production.close" en="Close" inline />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
