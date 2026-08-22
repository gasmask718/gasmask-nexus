/**
 * AmbassadorInviteGovernance — Owner/Admin panel for invite oversight
 * Global toggle, all invites table, revoke/extend actions
 */
import { useMemo, useState } from 'react';
import { Shield, Power, Search, X, UserPlus, Clock, Check, AlertTriangle, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAllInvites, useRevokeInvite, useInvitesEnabled, useToggleInvites, useResendAmbassadorInvite, useSendAmbassadorInvite, useInviteSendEvents } from '@/hooks/useAmbassadorInvites';
import { InviteDeliveryInfo } from '@/components/ambassador/InviteDeliveryInfo';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function AmbassadorInviteGovernance() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newChannel, setNewChannel] = useState<'sms' | 'email' | 'both'>('both');

  const { data: enabled, isLoading: enabledLoading } = useInvitesEnabled();
  const toggleInvites = useToggleInvites();
  const { data: invites = [], isLoading } = useAllInvites();
  const revokeInvite = useRevokeInvite();
  const resendInvite = useResendAmbassadorInvite();
  const sendInvite = useSendAmbassadorInvite();

  const inviteIds = useMemo(() => invites.map(i => i.id), [invites]);
  const { data: sendEvents = [] } = useInviteSendEvents(inviteIds);
  const eventsByInvite = useMemo(() => {
    const map: Record<string, typeof sendEvents> = {};
    for (const e of sendEvents) (map[e.invite_id] ||= []).push(e);
    return map;
  }, [sendEvents]);

  const handleCreateSend = async () => {
    if (!newEmail && !newPhone) {
      toast.error('Enter an email or phone number');
      return;
    }
    const result = await sendInvite.mutateAsync({
      name: newName || undefined,
      email: newEmail || undefined,
      phone: newPhone || undefined,
      channel: newChannel,
    });
    const failed = (result?.send_log || []).filter((l: any) => !l.ok);
    if (failed.length) {
      toast.warning(`Some channels failed: ${failed.map((l: any) => l.channel).join(', ')}`);
    }
    setShowCreate(false);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewChannel('both');
  };

  const filteredInvites = invites.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (inv.email || '').toLowerCase().includes(q) || (inv.phone || '').includes(q);
    }
    return true;
  });

  const stats = {
    total: invites.length,
    pending: invites.filter(i => i.status === 'pending').length,
    accepted: invites.filter(i => i.status === 'accepted').length,
    revoked: invites.filter(i => i.status === 'revoked').length,
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    await revokeInvite.mutateAsync({ inviteId: revokeTarget, reason: revokeReason });
    setRevokeTarget(null);
    setRevokeReason('');
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case 'accepted': return 'default' as const;
      case 'revoked': return 'destructive' as const;
      case 'expired': return 'outline' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Ambassador Invite Governance
          </h1>
          <p className="text-muted-foreground">Control, audit, and manage all ambassador invitations</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          New Invite
        </Button>
      </div>

      {/* Global Toggle */}
      <Card className="border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className={`h-5 w-5 ${enabled ? 'text-green-500' : 'text-destructive'}`} />
              <div>
                <Label className="text-base font-semibold">Ambassador Invites</Label>
                <p className="text-sm text-muted-foreground">
                  {enabled ? 'Ambassadors can create invites' : 'All invite creation is disabled'}
                </p>
              </div>
            </div>
            <Switch
              checked={!!enabled}
              onCheckedChange={(val) => toggleInvites.mutate(val)}
              disabled={enabledLoading || toggleInvites.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Invites', value: stats.total, icon: UserPlus },
          { label: 'Pending', value: stats.pending, icon: Clock },
          { label: 'Accepted', value: stats.accepted, icon: Check },
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by email or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {['all', 'pending', 'accepted', 'expired', 'revoked'].map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Invites Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Invited By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredInvites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No invites found
                  </TableCell>
                </TableRow>
              ) : filteredInvites.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">
                    {inv.email || inv.phone || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {inv.invited_by_user_id?.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(inv.created_at), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {inv.status === 'pending'
                      ? formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {inv.status === 'pending' && (inv.email || inv.phone) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        disabled={resendInvite.isPending}
                        onClick={() => resendInvite.mutate({ inviteId: inv.id, channel: inv.phone ? 'sms' : 'email' })}
                      >
                        Resend
                      </Button>
                    )}
                    {inv.status === 'pending' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setRevokeTarget(inv.id)}
                      >
                        Revoke
                      </Button>
                    )}
                    {inv.status === 'revoked' && inv.revoke_reason && (
                      <span className="text-xs text-muted-foreground">{inv.revoke_reason}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Revoke Dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revoke Invite
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="Why is this invite being revoked?"
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revokeInvite.isPending}>
              {revokeInvite.isPending ? 'Revoking...' : 'Revoke Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
