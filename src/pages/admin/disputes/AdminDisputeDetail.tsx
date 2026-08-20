/**
 * Admin Dispute Detail - Full dispute review and resolution interface
 * Supports: pickup, request info, approve (with adjustment), reject, resolve
 */
import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  Send,
  Clock,
  User,
  Shield,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
} from 'lucide-react';
import { format } from 'date-fns';
import {
import { toast } from 'sonner';
import { openSignedStorageObject } from '@/lib/storageLinks';
  useDispute,
  useDisputeMessages,
  useDisputeEvidence,
  useAddDisputeMessage,
  useAdminPickupDispute,
  useAdminRequestInfo,
  useAdminApproveDispute,
  useAdminRejectDispute,
  useAdminResolveDispute,
  REASON_CODE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from '@/hooks/useDisputes';

export default function AdminDisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: dispute, isLoading } = useDispute(id);
  const { data: messages = [] } = useDisputeMessages(id);
  const { data: evidence = [] } = useDisputeEvidence(id);
  
  const addMessage = useAddDisputeMessage();
  const pickupDispute = useAdminPickupDispute();
  const requestInfo = useAdminRequestInfo();
  const approveDispute = useAdminApproveDispute();
  const rejectDispute = useAdminRejectDispute();
  const resolveDispute = useAdminResolveDispute();
  
  const [newMessage, setNewMessage] = useState('');
  
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  
  // Form states
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [requestInfoMessage, setRequestInfoMessage] = useState('');

  const handleSendMessage = async () => {
    if (!id || !newMessage.trim()) return;
    await addMessage.mutateAsync({ disputeId: id, message: newMessage.trim() });
    setNewMessage('');
  };

  const handlePickup = async () => {
    if (!id) return;
    await pickupDispute.mutateAsync(id);
  };

  const handleRequestInfo = async () => {
    if (!id || !requestInfoMessage.trim()) return;
    await requestInfo.mutateAsync({ disputeId: id, message: requestInfoMessage.trim() });
    setRequestInfoMessage('');
    setShowRequestInfoModal(false);
  };

  const handleApprove = async () => {
    if (!id) return;
    await approveDispute.mutateAsync({
      disputeId: id,
      adjustmentAmount: parseFloat(adjustmentAmount) || 0,
      resolutionSummary: resolutionSummary || undefined,
    });
    setShowApproveModal(false);
  };

  const handleReject = async () => {
    if (!id) return;
    await rejectDispute.mutateAsync({
      disputeId: id,
      resolutionSummary: resolutionSummary || undefined,
    });
    setShowRejectModal(false);
  };

  const handleResolve = async () => {
    if (!id) return;
    await resolveDispute.mutateAsync({ disputeId: id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p>Dispute not found</p>
          <Link to="/admin/disputes">
            <Button variant="outline" className="mt-4">
              Back to Queue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const canPickup = dispute.status === 'submitted';
  const canTakeAction = ['submitted', 'under_review'].includes(dispute.status);
  const canResolve = ['approved', 'rejected'].includes(dispute.status);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/disputes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {dispute.title || REASON_CODE_LABELS[dispute.reason_code]}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={STATUS_COLORS[dispute.status]}>
                {STATUS_LABELS[dispute.status]}
              </Badge>
              <Badge variant="outline" className={PRIORITY_COLORS[dispute.priority]}>
                {dispute.priority}
              </Badge>
              <span className="text-sm text-muted-foreground">
                ID: {dispute.id.slice(0, 8)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canPickup && (
            <Button onClick={handlePickup} disabled={pickupDispute.isPending}>
              <Play className="h-4 w-4 mr-2" />
              Pick Up
            </Button>
          )}
          
          {canTakeAction && (
            <>
              <Button 
                variant="outline"
                onClick={() => setShowRequestInfoModal(true)}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Request Info
              </Button>
              
              <Button 
                variant="outline"
                className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                onClick={() => setShowRejectModal(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setAdjustmentAmount(dispute.requested_amount?.toString() || '');
                  setShowApproveModal(true);
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          
          {canResolve && (
            <Button onClick={handleResolve} disabled={resolveDispute.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark Resolved
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dispute Details */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Dispute Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Ambassador</div>
                  <div className="font-medium">{dispute.ambassador_name || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Reason</div>
                  <div className="font-medium">{REASON_CODE_LABELS[dispute.reason_code]}</div>
                </div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">Description</div>
                <div className="mt-1 whitespace-pre-wrap p-3 rounded-lg bg-muted/30 border border-border/50">
                  {dispute.description}
                </div>
              </div>
              
              {dispute.requested_amount && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <DollarSign className="h-5 w-5 text-amber-400" />
                  <div>
                    <div className="text-sm text-muted-foreground">Requested Amount</div>
                    <div className="font-bold text-lg">
                      ${dispute.requested_amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
              
              {dispute.resolution_summary && (
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="text-sm text-muted-foreground mb-1">Resolution Summary</div>
                  <div>{dispute.resolution_summary}</div>
                </div>
              )}
              
              {dispute.admin_notes && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="text-sm text-muted-foreground mb-1">Admin Notes</div>
                  <div>{dispute.admin_notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Conversation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No messages yet
                </p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.author_role === 'admin' ? '' : 'flex-row-reverse'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${
                        msg.author_role === 'admin' 
                          ? 'bg-amber-500/10' 
                          : 'bg-primary/10'
                      }`}>
                        {msg.author_role === 'admin' ? (
                          <Shield className="h-4 w-4 text-amber-400" />
                        ) : (
                          <User className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className={`flex-1 ${
                        msg.author_role === 'admin' ? 'pr-12' : 'pl-12'
                      }`}>
                        <div className={`p-3 rounded-lg ${
                          msg.author_role === 'admin'
                            ? 'bg-amber-500/10 border border-amber-500/20'
                            : 'bg-primary/10 border border-primary/20'
                        }`}>
                          <div className="text-xs text-muted-foreground mb-1">
                            {msg.author_role === 'admin' ? 'Admin' : 'Ambassador'} •{' '}
                            {format(new Date(msg.created_at), 'MMM d, yyyy, h:mm a')}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.message}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-4" />
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || addMessage.isPending}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <div>
                  <div className="text-sm font-medium">Submitted</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(dispute.submitted_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              </div>
              
              {dispute.reviewed_at && (
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <div>
                    <div className="text-sm font-medium">Reviewed</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(dispute.reviewed_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                </div>
              )}
              
              {dispute.resolved_at && (
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-400" />
                  <div>
                    <div className="text-sm font-medium">Resolved</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(dispute.resolved_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Commission */}
          {dispute.commission_ledger && (
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Related Commission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-muted-foreground">Source</div>
                  <div className="font-medium">
                    {(dispute.commission_ledger as any)?.source_name || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Amount</div>
                  <div className="font-medium">
                    ${((dispute.commission_ledger as any)?.commission_amount || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Earned</div>
                  <div className="font-medium">
                    {(dispute.commission_ledger as any)?.earned_at 
                      ? format(new Date((dispute.commission_ledger as any).earned_at), 'MMM d, yyyy')
                      : 'N/A'
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evidence */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="h-4 w-4 text-primary" />
                Evidence ({evidence.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No evidence attached
                </p>
              ) : (
                <div className="space-y-2">
                  {evidence.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => openSignedStorageObject('dispute-evidence', e.file_url).catch((err: any) => toast.error(err.message || 'Could not open attachment'))}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate flex-1">
                        {e.file_name || 'Attachment'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Dispute</DialogTitle>
            <DialogDescription>
              This will create an adjustment in the commission ledger.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Adjustment Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The amount to credit to the ambassador's ledger
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Resolution Summary (Optional)</Label>
              <Textarea
                placeholder="Explain the resolution..."
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveModal(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={approveDispute.isPending}
            >
              {approveDispute.isPending ? 'Approving...' : 'Approve & Create Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Dispute</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this dispute.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Explain why this dispute is being rejected..."
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleReject}
              disabled={rejectDispute.isPending}
            >
              {rejectDispute.isPending ? 'Rejecting...' : 'Reject Dispute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Info Modal */}
      <Dialog open={showRequestInfoModal} onOpenChange={setShowRequestInfoModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request More Information</DialogTitle>
            <DialogDescription>
              Ask the ambassador for additional details or evidence.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Message to Ambassador</Label>
              <Textarea
                placeholder="What information do you need?"
                value={requestInfoMessage}
                onChange={(e) => setRequestInfoMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestInfoModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRequestInfo}
              disabled={!requestInfoMessage.trim() || requestInfo.isPending}
            >
              {requestInfo.isPending ? 'Sending...' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
