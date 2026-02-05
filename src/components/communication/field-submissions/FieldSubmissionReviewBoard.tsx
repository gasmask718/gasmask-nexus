// ═══════════════════════════════════════════════════════════════════════════════
// FIELD ACTIVITY REVIEW BOARD (GOVERNANCE-GRADE)
// Admin dashboard for reviewing all field-user actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  RefreshCw,
  User,
  Store,
  MapPin,
  Smartphone,
  Monitor,
  MessageSquare,
  Undo2,
  Download,
  TestTube2,
  Shield,
  Copy,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
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
} from '@/hooks/useFieldSubmissions';
import { Link } from 'react-router-dom';
import { SubmissionFilters, type SubmissionFiltersState } from './SubmissionFilters';
import { SubmissionDiffView } from './SubmissionDiffView';
import { RiskBadge } from './RiskBadge';
import { cn } from '@/lib/utils';
import { GOVERNANCE_STRICT_MODE } from '@/services/fieldGovernance';
import { ExportButton } from '@/components/crud/ExportButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function FieldSubmissionReviewBoard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<SubmissionFiltersState>({
    search: '',
    status: 'all',
    entityType: 'all',
    timeRange: 'all',
    quickFilter: null,
  });
  const [selectedSubmission, setSelectedSubmission] = useState<FieldSubmission | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const { data: stats, isLoading: statsLoading } = useFieldSubmissionStats();
  const { data: submissions, isLoading, refetch } = useFieldSubmissions({
    status: filters.status === 'all' ? undefined : filters.status,
    entityType: filters.entityType === 'all' ? undefined : filters.entityType,
    search: filters.search || undefined,
    timeRange: filters.timeRange,
    quickFilter: filters.quickFilter,
  });

  const approveMutation = useApproveSubmission();
  const rejectMutation = useRejectSubmission();

  // Seed a test submission for verification
  const handleSeedTest = async () => {
    if (!user?.id) {
      toast.error('Not authenticated');
      return;
    }
    
    setSeeding(true);
    try {
      // Create a test submission
      const testPayload = {
        submitted_by_user_id: user.id,
        submitted_by_role: 'driver',
        store_id: '00000000-0000-0000-0000-000000000000', // Placeholder
        entity_type: 'brand_sticker' as const,
        entity_id: null,
        action_type: 'update' as const,
        payload_before: { test_field: 'before_value', sticker_type: 'front_door_sticker', value: false },
        payload_after: { test_field: 'after_value', sticker_type: 'front_door_sticker', value: true },
        submission_source: 'admin_panel',
        submission_status: 'pending_review' as const,
        is_applied: false,
      };
      
      const { data, error } = await supabase
        .from('field_submissions')
        .insert([testPayload])
        .select('id')
        .single();
      
      if (error) throw error;
      
      toast.success(`Test submission created: ${data.id.substring(0, 8)}...`);
      refetch();
    } catch (err) {
      toast.error('Failed to seed test submission');
      console.error(err);
    } finally {
      setSeeding(false);
    }
  };

  // Copy submission ID to clipboard
  const copySubmissionId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Submission ID copied');
  };

  // Prepare export data
  const exportData = (submissions || []).map(sub => ({
    id: sub.id,
    created_at: sub.created_at,
    submitter: sub.submitter_name,
    role: sub.submitted_by_role,
    store: sub.store_name,
    entity_type: sub.entity_type,
    action_type: sub.action_type,
    status: sub.submission_status,
    risk_score: sub.risk_score,
    source: sub.submission_source,
    changed_fields: sub.changed_fields?.join(', ') || '',
  }));

  const exportColumns = [
    { key: 'id', label: 'Submission ID' },
    { key: 'created_at', label: 'Timestamp' },
    { key: 'submitter', label: 'Submitter' },
    { key: 'role', label: 'Role' },
    { key: 'store', label: 'Store' },
    { key: 'entity_type', label: 'Entity Type' },
    { key: 'action_type', label: 'Action' },
    { key: 'status', label: 'Status' },
    { key: 'risk_score', label: 'Risk Score' },
    { key: 'source', label: 'Source' },
    { key: 'changed_fields', label: 'Changed Fields' },
  ];

  const handleApprove = async (id: string) => {
    await approveMutation.mutateAsync(id);
    setSelectedSubmission(null);
    setDetailSheetOpen(false);
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
    setDetailSheetOpen(false);
  };

  const openDetail = (sub: FieldSubmission) => {
    setSelectedSubmission(sub);
    setDetailSheetOpen(true);
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
      isQuickFilter: true,
    },
  ];

  const getSourceIcon = (source: string | null) => {
    switch (source) {
      case 'mobile':
      case 'driver_portal':
      case 'biker_portal':
        return <Smartphone className="h-3 w-3" />;
      case 'desktop':
      case 'admin':
        return <Monitor className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Governance Mode Banner */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 rounded-lg border",
        GOVERNANCE_STRICT_MODE 
          ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
          : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400"
      )}>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="font-medium">
            Governance Mode: {GOVERNANCE_STRICT_MODE ? 'STRICT' : 'AUTO-APPROVE'}
          </span>
          {GOVERNANCE_STRICT_MODE && (
            <span className="text-sm opacity-80">
              — Field changes require admin approval before applying
            </span>
          )}
        </div>
        <div className="text-sm opacity-70">
          Last refresh: {format(new Date(), 'HH:mm:ss')}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Field Activity Review</h2>
          <p className="text-muted-foreground">
            Review and approve actions submitted by drivers, bikers, and ambassadors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton 
            data={exportData} 
            filename="field-submissions" 
            columns={exportColumns}
            disabled={!submissions?.length}
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSeedTest}
            disabled={seeding}
          >
            <TestTube2 className="h-4 w-4 mr-2" />
            Seed Test
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const isActive = stat.isQuickFilter 
            ? filters.quickFilter === 'high_risk'
            : filters.status === stat.filter;
          return (
            <Card 
              key={stat.label}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isActive && "ring-2 ring-primary"
              )}
              onClick={() => {
                if (stat.isQuickFilter) {
                  setFilters(f => ({ 
                    ...f, 
                    quickFilter: f.quickFilter === 'high_risk' ? null : 'high_risk',
                    status: 'all'
                  }));
                } else {
                  setFilters(f => ({ 
                    ...f, 
                    status: f.status === stat.filter ? 'all' : stat.filter!,
                    quickFilter: null
                  }));
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", stat.bgColor)}>
                    <Icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                  <div>
                    <div className={cn("text-2xl font-bold", stat.color)}>
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

      {/* Advanced Filters */}
      <SubmissionFilters 
        filters={filters} 
        onChange={setFilters}
        stats={{
          highRisk: stats?.highRisk || 0,
          pendingOld: stats?.pendingOld || 0,
          multipleSameUser: stats?.multipleSameUser || 0,
        }}
      />

      {/* Submissions Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Submissions ({submissions?.length || 0})</CardTitle>
            {filters.quickFilter && (
              <Badge variant="secondary">
                Filtered: {filters.quickFilter.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !submissions?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Timestamp</TableHead>
                    <TableHead>Submitter</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub) => (
                    <TableRow 
                      key={sub.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        (sub.risk_score || 0) >= 50 && "bg-orange-500/5"
                      )}
                      onClick={() => openDetail(sub)}
                    >
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          {getSourceIcon(sub.submission_source)}
                          <span>{formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">{sub.submitter_name}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {sub.submitted_by_role}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/stores/${sub.store_id}`}
                          className="flex items-start gap-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Store className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-sm font-medium">{sub.store_name}</div>
                            {sub.store_address && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {sub.store_address.substring(0, 30)}...
                              </div>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs">
                            {getEntityTypeLabel(sub.entity_type)}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {getActionTypeLabel(sub.action_type)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.changed_fields && sub.changed_fields.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {sub.changed_fields.slice(0, 3).map(field => (
                              <Badge 
                                key={field} 
                                variant="secondary" 
                                className="text-xs px-1.5 py-0"
                              >
                                {field.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                            {sub.changed_fields.length > 3 && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                +{sub.changed_fields.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(sub.submission_status)}>
                          {sub.submission_status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <RiskBadge 
                          score={sub.risk_score} 
                          reasons={sub.risk_reasons}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(sub);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {sub.submission_status === 'pending_review' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(sub.id);
                                }}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet (Side Panel) */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Submission Details
              {selectedSubmission && (
                <Badge className={getStatusColor(selectedSubmission.submission_status)}>
                  {selectedSubmission.submission_status.replace('_', ' ')}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              Review the changes made by the field user
            </SheetDescription>
          </SheetHeader>
          
          {selectedSubmission && (
            <div className="mt-6 space-y-6">
              {/* Context Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Submitter
                  </label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedSubmission.submitter_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {selectedSubmission.submitted_by_role}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Store
                  </label>
                  <div className="flex items-start gap-2">
                    <Store className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <Link 
                        to={`/stores/${selectedSubmission.store_id}`}
                        className="font-medium hover:underline"
                      >
                        {selectedSubmission.store_name}
                      </Link>
                      {selectedSubmission.store_address && (
                        <p className="text-xs text-muted-foreground">
                          {selectedSubmission.store_address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Entity
                  </label>
                  <Badge variant="outline">
                    {getEntityTypeLabel(selectedSubmission.entity_type)}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Action
                  </label>
                  <p className="font-medium capitalize">
                    {getActionTypeLabel(selectedSubmission.action_type)}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Submitted
                  </label>
                  <p className="text-sm">
                    {format(new Date(selectedSubmission.created_at), 'PPp')}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Risk Score
                  </label>
                  <RiskBadge 
                    score={selectedSubmission.risk_score} 
                    reasons={selectedSubmission.risk_reasons}
                    showLabel
                  />
                </div>
              </div>

              {/* Risk Reasons */}
              {selectedSubmission.risk_reasons && selectedSubmission.risk_reasons.length > 0 && (
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-2 text-sm font-medium text-orange-600 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Risk Factors
                  </div>
                  <ul className="text-sm space-y-1">
                    {selectedSubmission.risk_reasons.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-orange-500">•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diff View */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Changes
                </label>
                <SubmissionDiffView 
                  before={selectedSubmission.payload_before}
                  after={selectedSubmission.payload_after}
                  changedFields={selectedSubmission.changed_fields || undefined}
                />
              </div>

              {/* Rejection Reason (if rejected) */}
              {selectedSubmission.rejection_reason && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
                    <XCircle className="h-4 w-4" />
                    Rejection Reason
                  </div>
                  <p className="text-sm">{selectedSubmission.rejection_reason}</p>
                </div>
              )}

              {/* Admin Notes */}
              {selectedSubmission.admin_notes && (
                <div className="p-3 rounded-lg bg-muted border">
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <MessageSquare className="h-4 w-4" />
                    Admin Notes
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedSubmission.admin_notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {selectedSubmission.submission_status === 'pending_review' && (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setRejectDialogOpen(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleApprove(selectedSubmission.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </>
                )}
                {selectedSubmission.submission_status === 'approved' && !selectedSubmission.is_rolled_back && (
                  <Button variant="outline" className="flex-1" disabled>
                    <Undo2 className="h-4 w-4 mr-2" />
                    Rollback (Coming Soon)
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
