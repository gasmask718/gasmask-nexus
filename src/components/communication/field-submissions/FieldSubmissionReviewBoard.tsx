// ═══════════════════════════════════════════════════════════════════════════════
// FIELD SUBMISSION REVIEW BOARD
// Admin dashboard for reviewing all field-user actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  RefreshCw,
  Filter,
  User,
  Store,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { 
  useFieldSubmissions, 
  useFieldSubmissionStats,
  useApproveSubmission,
  useRejectSubmission,
  getEntityTypeLabel,
  getActionTypeLabel,
  getStatusColor,
  type FieldSubmission,
  type FieldSubmissionStatus,
  type FieldEntityType,
} from '@/hooks/useFieldSubmissions';
import { Link } from 'react-router-dom';

export function FieldSubmissionReviewBoard() {
  const [statusFilter, setStatusFilter] = useState<FieldSubmissionStatus | 'all'>('all');
  const [entityFilter, setEntityFilter] = useState<FieldEntityType | 'all'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<FieldSubmission | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: stats, isLoading: statsLoading } = useFieldSubmissionStats();
  const { data: submissions, isLoading, refetch } = useFieldSubmissions({
    status: statusFilter === 'all' ? undefined : statusFilter,
    entityType: entityFilter === 'all' ? undefined : entityFilter,
  });

  const approveMutation = useApproveSubmission();
  const rejectMutation = useRejectSubmission();

  const handleApprove = async (id: string) => {
    await approveMutation.mutateAsync(id);
    setSelectedSubmission(null);
  };

  const handleReject = async () => {
    if (!selectedSubmission || !rejectionReason.trim()) return;
    await rejectMutation.mutateAsync({ 
      submissionId: selectedSubmission.id, 
      reason: rejectionReason 
    });
    setRejectDialogOpen(false);
    setRejectionReason('');
    setSelectedSubmission(null);
  };

  const statCards = [
    { 
      label: 'Pending Review', 
      value: stats?.pending || 0, 
      icon: Clock, 
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      filter: 'pending_review' as FieldSubmissionStatus,
    },
    { 
      label: 'Approved', 
      value: stats?.approved || 0, 
      icon: CheckCircle, 
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      filter: 'approved' as FieldSubmissionStatus,
    },
    { 
      label: 'Rejected', 
      value: stats?.rejected || 0, 
      icon: XCircle, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      filter: 'rejected' as FieldSubmissionStatus,
    },
    { 
      label: 'High Risk', 
      value: stats?.highRisk || 0, 
      icon: AlertTriangle, 
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      filter: 'all' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Field Activity Review</h2>
          <p className="text-muted-foreground">
            Review and approve actions submitted by drivers, bikers, and ambassadors
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const isActive = statusFilter === stat.filter;
          return (
            <Card 
              key={stat.label}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isActive ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setStatusFilter(stat.filter === 'all' ? 'all' : stat.filter)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${stat.color}`}>
                      {statsLoading ? '...' : stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select 
              value={statusFilter} 
              onValueChange={(v) => setStatusFilter(v as FieldSubmissionStatus | 'all')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="auto_approved">Auto-Approved</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={entityFilter} 
              onValueChange={(v) => setEntityFilter(v as FieldEntityType | 'all')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="brand_sticker">Brand Stickers</SelectItem>
                <SelectItem value="tube_inventory">Tube Inventory</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="order_note">Order Notes</SelectItem>
                <SelectItem value="visit_log">Visit Logs</SelectItem>
                <SelectItem value="store_update">Store Updates</SelectItem>
              </SelectContent>
            </Select>
            {(statusFilter !== 'all' || entityFilter !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setEntityFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submissions ({submissions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !submissions?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{sub.submitter_name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {sub.submitted_by_role}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/stores/${sub.store_id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{sub.store_name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getEntityTypeLabel(sub.entity_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">
                        {getActionTypeLabel(sub.action_type)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(sub.submission_status)}>
                        {sub.submission_status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(sub.risk_score || 0) >= 50 ? (
                        <Badge variant="destructive">{sub.risk_score}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {sub.risk_score || 0}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSubmission(sub)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {sub.submission_status === 'pending_review' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleApprove(sub.id)}
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedSubmission(sub);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog 
        open={!!selectedSubmission && !rejectDialogOpen} 
        onOpenChange={(open) => !open && setSelectedSubmission(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Review the changes made by the field user
            </DialogDescription>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitter</label>
                  <p className="font-medium">{selectedSubmission.submitter_name}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedSubmission.submitted_by_role}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Store</label>
                  <p className="font-medium">{selectedSubmission.store_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Entity</label>
                  <p className="font-medium">
                    {getEntityTypeLabel(selectedSubmission.entity_type)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action</label>
                  <p className="font-medium capitalize">
                    {getActionTypeLabel(selectedSubmission.action_type)}
                  </p>
                </div>
              </div>

              {selectedSubmission.payload_before && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Before</label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-auto max-h-40">
                    {JSON.stringify(selectedSubmission.payload_before, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">After (Changes)</label>
                <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-auto max-h-40">
                  {JSON.stringify(selectedSubmission.payload_after, null, 2)}
                </pre>
              </div>

              {selectedSubmission.rejection_reason && (
                <div>
                  <label className="text-sm font-medium text-destructive">Rejection Reason</label>
                  <p className="mt-1 p-3 bg-destructive/10 rounded-md text-sm">
                    {selectedSubmission.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedSubmission?.submission_status === 'pending_review' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectDialogOpen(true);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleApprove(selectedSubmission.id)}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this submission.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              Reject Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
