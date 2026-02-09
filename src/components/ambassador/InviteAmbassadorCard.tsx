/**
 * InviteAmbassadorCard — Replaces ReferralLinkCard
 * Governed invite creation: single-use tokens, no raw URLs
 */
import { useState } from 'react';
import { Copy, Check, UserPlus, Clock, AlertTriangle, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useMyInvites, useCreateInvite, useInvitesEnabled } from '@/hooks/useAmbassadorInvites';
import { formatDistanceToNow } from 'date-fns';

export function InviteAmbassadorCard() {
  const [showDialog, setShowDialog] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: invitesEnabled } = useInvitesEnabled();
  const { data: myInvites = [], isLoading } = useMyInvites();
  const createInvite = useCreateInvite();

  const pendingCount = myInvites.filter(i => i.status === 'pending').length;
  const acceptedCount = myInvites.filter(i => i.status === 'accepted').length;

  const handleCreate = async () => {
    const result = await createInvite.mutateAsync({ email: email || undefined, phone: phone || undefined });
    if (result?.token) {
      const link = `${window.location.origin}/invite/ambassador/${result.token}`;
      setGeneratedLink(link);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEmail('');
    setPhone('');
    setGeneratedLink(null);
    setCopied(false);
  };

  if (isLoading) return null;

  if (!invitesEnabled) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Ambassador invites are currently disabled</span>
          </div>
        </CardContent>
      </Card>
    );
  }

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
                Create governed invites to grow your team
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {pendingCount > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  {pendingCount} pending
                </Badge>
              )}
              {acceptedCount > 0 && (
                <Badge variant="default" className="shrink-0">
                  {acceptedCount} joined
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setShowDialog(true)}>
            <Send className="h-4 w-4 mr-2" />
            Create Invite
          </Button>

          {/* Recent invites */}
          {myInvites.slice(0, 3).map(invite => (
            <div key={invite.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded border">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{invite.email || invite.phone || 'No contact'}</span>
              </div>
              <Badge
                variant={invite.status === 'accepted' ? 'default' : invite.status === 'revoked' ? 'destructive' : 'secondary'}
                className="text-xs shrink-0"
              >
                {invite.status}
              </Badge>
            </div>
          ))}

          <p className="text-xs text-muted-foreground text-center">
            Invites are monitored. Single-use, 48h expiry.
          </p>
        </CardContent>
      </Card>

      {/* Create Invite Dialog */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Ambassador Invite</DialogTitle>
            <DialogDescription>
              Generate a single-use invite link. The invitee will be onboarded as an ambassador under your team.
            </DialogDescription>
          </DialogHeader>

          {!generatedLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input
                  placeholder="ambassador@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input
                  placeholder="+1234567890"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  type="tel"
                />
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Invites are monitored. Abuse will result in revocation.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createInvite.isPending}>
                  {createInvite.isPending ? 'Creating...' : 'Generate Invite'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Invite Link (single-use, expires in 48h)</Label>
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly className="text-xs bg-muted/30" />
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with the person you want to invite. It can only be used once.
              </p>
              <DialogFooter>
                <Button onClick={handleCloseDialog}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default InviteAmbassadorCard;
