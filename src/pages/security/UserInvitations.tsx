import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Mail, Copy, RotateCcw, Ban, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { OSRole } from '@/config/osNavigation';
import {
  createInvitation,
  getInvitations,
  getEffectiveStatus,
  resendInvitation,
  revokeUserAccess,
  reinstateUserAccess,
  type Invitation,
  type InviteStatus,
} from '@/services/invitationService';

const INVITABLE_ROLES: OSRole[] = [
  'admin', 'va', 'driver', 'biker', 'ambassador', 'store_owner',
  'wholesaler', 'production', 'accountant', 'csr',
];

const STATUS_STYLE: Record<InviteStatus, string> = {
  sent: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  expired: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  revoked: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

export default function UserInvitations() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<OSRole>('va');
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: invitations = [], isLoading, error } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: async () => {
      const { invitations, error } = await getInvitations();
      if (error) throw new Error(error);
      return invitations;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['user-invitations'] });

  async function handleSend() {
    if (!email.trim()) {
      toast.error('Email is required.');
      return;
    }
    setSending(true);
    try {
      const res = await createInvitation({
        email,
        phone: phone.trim() || undefined,
        role,
      });
      if (res.error) throw new Error(res.error);
      toast.success(
        res.emailSent
          ? `Invitation emailed to ${email}`
          : `Invitation created for ${email} — email delivery failed, copy the link instead.`,
      );
      setEmail('');
      setPhone('');
      refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create invitation', { duration: 8000 });
    } finally {
      setSending(false);
    }
  }

  function copyLink(inv: Invitation) {
    const url = `${window.location.origin}/invite/${inv.invite_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied.');
  }

  async function handleResend(inv: Invitation) {
    setBusyId(inv.id);
    const { error } = await resendInvitation(inv.id);
    setBusyId(null);
    if (error) return toast.error(error, { duration: 8000 });
    toast.success('Invitation reissued with a fresh 72-hour token.');
    refresh();
  }

  async function handleRevoke(inv: Invitation) {
    const reason = window.prompt('Reason for revoking access?') || undefined;
    setBusyId(inv.id);
    const { error } = await revokeUserAccess(inv.id, reason);
    setBusyId(null);
    if (error) return toast.error(error, { duration: 8000 });
    toast.success('Access revoked.');
    refresh();
  }

  async function handleReinstate(inv: Invitation) {
    setBusyId(inv.id);
    const { error } = await reinstateUserAccess(inv.id);
    setBusyId(null);
    if (error) return toast.error(error, { duration: 8000 });
    toast.success('Access reinstated.');
    refresh();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary" />
          User Invitations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          The single supported way to create a user. Invitees receive an emailed link,
          accept it at <code>/invite/:token</code>, and land with exactly the role issued here.
        </p>
      </div>

      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Send an invitation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-phone">Phone (optional)</Label>
            <Input
              id="invite-phone"
              placeholder="+1..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as OSRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-4">
            <Button onClick={handleSend} disabled={sending}>
              {sending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Mail className="h-4 w-4 mr-2" />}
              Send invitation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">
            Issued invitations {invitations.length > 0 && `(${invitations.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive py-4">{(error as Error).message}</p>
          )}
          {!isLoading && !error && invitations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No invitations issued yet.
            </p>
          )}
          {!isLoading && invitations.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => {
                    const status = getEffectiveStatus(inv);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{inv.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLE[status]}>
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(inv.expires_at).toLocaleString('en-US', {
                            timeZone: 'America/New_York',
                          })}
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyLink(inv)}
                            title="Copy invite link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {status !== 'accepted' && status !== 'revoked' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === inv.id}
                              onClick={() => handleResend(inv)}
                              title="Reissue token"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {status === 'revoked' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === inv.id}
                              onClick={() => handleReinstate(inv)}
                            >
                              Reinstate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={busyId === inv.id}
                              onClick={() => handleRevoke(inv)}
                              title="Revoke access"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
