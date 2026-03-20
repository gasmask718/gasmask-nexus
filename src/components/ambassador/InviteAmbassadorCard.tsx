/**
 * InviteAmbassadorCard — Ambassador submits recruit REQUESTS
 * Admins review and send the actual invite.
 */
import { useState } from 'react';
import { UserPlus, Clock, AlertTriangle, Send, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useMyRequests, useSubmitRequest } from '@/hooks/useAmbassadorRequests';
import { formatDistanceToNow } from 'date-fns';

export function InviteAmbassadorCard() {
  const [showDialog, setShowDialog] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [territory, setTerritory] = useState('');
  const [justification, setJustification] = useState('');

  const { data: myRequests = [], isLoading } = useMyRequests();
  const submitRequest = useSubmitRequest();

  const pendingCount = myRequests.filter(r => r.status === 'pending').length;
  const approvedCount = myRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = myRequests.filter(r => r.status === 'rejected').length;

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!justification.trim()) {
      toast.error('Please explain why this person should be recruited');
      return;
    }

    await submitRequest.mutateAsync({
      full_name: fullName.trim(),
      email: email.trim(),
      territory: territory.trim() || undefined,
      justification: justification.trim(),
    });

    handleCloseDialog();
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setFullName('');
    setEmail('');
    setTerritory('');
    setJustification('');
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="text-xs shrink-0 gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-xs shrink-0 gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs shrink-0 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    }
  };

  if (isLoading) return null;

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Recruit Ambassadors
              </CardTitle>
              <CardDescription className="text-xs">
                Submit a recruit request — admin will send the invite
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {pendingCount > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  {pendingCount} pending
                </Badge>
              )}
              {approvedCount > 0 && (
                <Badge variant="default" className="shrink-0">
                  {approvedCount} approved
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setShowDialog(true)}>
            <Send className="h-4 w-4 mr-2" />
            Request Invite for Recruit
          </Button>

          {/* Recent requests */}
          {myRequests.slice(0, 5).map(req => (
            <div key={req.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded border">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium truncate">{req.full_name}</span>
                <span className="text-muted-foreground truncate">{req.email}</span>
                {req.review_notes && req.status !== 'pending' && (
                  <span className="text-muted-foreground/70 italic truncate">
                    Note: {req.review_notes}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                {statusBadge(req.status)}
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}

          {myRequests.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No recruit requests yet. Found someone? Submit a request above.
            </p>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Requests are reviewed by admin before invites are sent.
          </p>
        </CardContent>
      </Card>

      {/* Submit Request Dialog */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Ambassador Invite</DialogTitle>
            <DialogDescription>
              Tell us about the person you want to recruit. Admin will review and send the invite if approved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="John Smith"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                placeholder="recruit@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Territory / Area</Label>
              <Input
                placeholder="e.g. Brooklyn, NY"
                value={territory}
                onChange={e => setTerritory(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Why should we recruit this person? *</Label>
              <Textarea
                placeholder="Explain how you know them, their experience, why they'd be a good ambassador..."
                value={justification}
                onChange={e => setJustification(e.target.value)}
                rows={3}
              />
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Your request will be reviewed by admin. You'll see the status update here.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitRequest.isPending}>
                {submitRequest.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default InviteAmbassadorCard;
