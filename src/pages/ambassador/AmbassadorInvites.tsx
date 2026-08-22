/**
 * AmbassadorInvites — Full invite management page for ambassador portal
 */
import { useMemo, useState } from 'react';
import { UserPlus, Clock, Check, X, Send, AlertTriangle, Copy } from 'lucide-react';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMyInvites, useCreateInvite, useInvitesEnabled, useSendAmbassadorInvite, useResendAmbassadorInvite, useInviteSendEvents } from '@/hooks/useAmbassadorInvites';
import { InviteDeliveryInfo } from '@/components/ambassador/InviteDeliveryInfo';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

function InvitesContent() {
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteeName, setInviteeName] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('sms');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const { data: enabled } = useInvitesEnabled();
  const { data: invites = [], isLoading } = useMyInvites();
  const createInvite = useCreateInvite();
  const sendInvite = useSendAmbassadorInvite();
  const resendInvite = useResendAmbassadorInvite();

  const stats = {
    total: invites.length,
    pending: invites.filter(i => i.status === 'pending').length,
    accepted: invites.filter(i => i.status === 'accepted').length,
    expired: invites.filter(i => i.status === 'expired').length,
    revoked: invites.filter(i => i.status === 'revoked').length,
  };

  const handleSend = async () => {
    if (!email && !phone) {
      toast.error('Enter an email or phone number');
      return;
    }
    const result = await sendInvite.mutateAsync({
      name: inviteeName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      channel,
    });
    if (result?.link) setGeneratedLink(result.link);
  };

  const handleCreate = async () => {
    const result = await createInvite.mutateAsync({ email: email || undefined, phone: phone || undefined });
    if (result?.token) {
      setGeneratedLink(`${window.location.origin}/invite/ambassador/${result.token}`);
    }
  };

  const handleCopy = async (link: string) => {
    await navigator.clipboard.writeText(link);
    toast.success('Link copied');
  };

  const handleClose = () => {
    setShowCreate(false);
    setEmail('');
    setPhone('');
    setInviteeName('');
    setChannel('sms');
    setGeneratedLink(null);
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case 'accepted': return 'default';
      case 'revoked': return 'destructive';
      case 'expired': return 'outline';
      default: return 'secondary';
    }
  };

  if (!enabled) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="h-5 w-5 mr-2" />
        Ambassador invites are currently disabled by administration.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Sent', value: stats.total, icon: Send },
          { label: 'Pending', value: stats.pending, icon: Clock },
          { label: 'Accepted', value: stats.accepted, icon: Check },
          { label: 'Expired', value: stats.expired, icon: Clock },
          { label: 'Revoked', value: stats.revoked, icon: X },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <s.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Invites are single-use, expire in 48 hours, and are fully audited.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Create Invite
        </Button>
      </div>

      {/* Invites Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : invites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No invites yet. Create your first invite to start recruiting.
                  </TableCell>
                </TableRow>
              ) : invites.map(invite => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">
                    {invite.email || invite.phone || <span className="text-muted-foreground">No contact</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(invite.status)}>{invite.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {invite.status === 'pending'
                      ? formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {invite.status === 'pending' && invite.invite_token && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(`${window.location.origin}/invite/ambassador/${invite.invite_token}`)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    )}
                    {invite.status === 'pending' && (invite.email || invite.phone) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={resendInvite.isPending}
                        onClick={() => resendInvite.mutate({ inviteId: invite.id, channel: invite.phone ? 'sms' : 'email' })}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Resend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Ambassador Invite</DialogTitle>
            <DialogDescription>
              Generate a single-use invite link. Expires in 48 hours.
            </DialogDescription>
          </DialogHeader>
          {!generatedLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name (optional)</Label>
                <Input placeholder="Invitee name" value={inviteeName} onChange={e => setInviteeName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} type="email" />
              </div>
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input placeholder="+1234567890" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
              </div>
              <div className="space-y-2">
                <Label>Send via</Label>
                <select
                  value={channel}
                  onChange={e => setChannel(e.target.value as 'sms' | 'email' | 'both')}
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Invites are monitored. Abuse will result in revocation.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button variant="outline" onClick={handleCreate} disabled={createInvite.isPending || sendInvite.isPending}>
                  {createInvite.isPending ? 'Creating...' : 'Link only'}
                </Button>
                <Button onClick={handleSend} disabled={sendInvite.isPending || createInvite.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  {sendInvite.isPending ? 'Sending...' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <Label>Invite Link</Label>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="text-xs bg-muted/30" />
                <Button variant="outline" size="icon" onClick={() => handleCopy(generatedLink)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Single-use. Expires in 48 hours.</p>
              <DialogFooter>
                <Button onClick={handleClose}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AmbassadorInvites() {
  return (
    <PortalRBACGate allowedRoles={['ambassador', 'admin']} portalName="Ambassador Portal">
      <AmbassadorLayout
        title="My Invites"
        subtitle="Recruit new ambassadors with governed invites"
        backPath="/ambassador/dashboard"
        portalIcon={<UserPlus className="h-4 w-4 text-primary-foreground" />}
      >
        <InvitesContent />
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
