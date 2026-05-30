import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Plus, Ban, Loader2, Link2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const INVITE_ROLES = [
  'driver', 'biker', 'ambassador', 'influencer',
  'store', 'store_owner', 'wholesaler', 'customer', 'production',
] as const;

/**
 * OpsInviteManager — Admin panel for creating & managing portal invites
 */
export default function OpsInviteManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState<string>('driver');
  const [newEmail, setNewEmail] = useState('');
  const [newMaxUses, setNewMaxUses] = useState(1);
  const [newExpiryHours, setNewExpiryHours] = useState(48);

  const { data: invites, isLoading } = useQuery({
    queryKey: ['portal-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_invites')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Generate 256-bit random token
      const rawBytes = new Uint8Array(32);
      crypto.getRandomValues(rawBytes);
      const rawToken = Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // Hash it for storage
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawToken));
      const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date(Date.now() + newExpiryHours * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from('portal_invites').insert({
        token_hash: tokenHash,
        role: newRole as any,
        email: newEmail || null,
        created_by: user.id,
        expires_at: expiresAt,
        max_uses: newMaxUses,
      });
      if (error) throw error;

      return rawToken; // Return raw token to show in UI
    },
    onSuccess: (rawToken) => {
      const link = `${window.location.origin}/portal/invite/${rawToken}`;
      navigator.clipboard.writeText(link).then(() => {
        toast.success('Invite created & link copied!');
      }).catch(() => {
        toast.success('Invite created! Copy the link below.');
      });
      queryClient.invalidateQueries({ queryKey: ['portal-invites'] });
      setShowCreate(false);
      setNewEmail('');

      // Show a temporary dialog with the link
      window.prompt('Invite link (copy this — it won\'t be shown again):', link);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const revokeInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('portal_invites')
        .update({ status: 'revoked' as any, revoked_at: new Date().toISOString(), revoked_by: user.id })
        .eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invite revoked');
      queryClient.invalidateQueries({ queryKey: ['portal-invites'] });
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'consumed': return 'secondary';
      case 'revoked': return 'destructive';
      case 'expired': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Portal Invites
        </CardTitle>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-1" /> New Invite
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create form */}
        {showCreate && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map(r => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email (optional)</label>
                <Input
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Max Uses</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newMaxUses}
                  onChange={e => setNewMaxUses(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Expires In (hours)</label>
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={newExpiryHours}
                  onChange={e => setNewExpiryHours(parseInt(e.target.value) || 48)}
                />
              </div>
            </div>
            <Button
              onClick={() => createInvite.mutate()}
              disabled={createInvite.isPending}
              className="w-full"
            >
              {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Shield className="h-4 w-4 mr-1" />}
              Generate Invite Link
            </Button>
          </div>
        )}

        {/* Invites list */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {invites?.map(invite => (
              <div key={invite.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{invite.role}</span>
                    <Badge variant={statusColor(invite.status as string)}>{invite.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {invite.uses}/{invite.max_uses} uses
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {invite.email && <span>{invite.email} · </span>}
                    Created {format(new Date(invite.created_at), 'MMM d, yyyy HH:mm')}
                    {' · Expires '}
                    {format(new Date(invite.expires_at), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
                {invite.status === 'active' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeInvite.mutate(invite.id)}
                    disabled={revokeInvite.isPending}
                  >
                    <Ban className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {(!invites || invites.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No invites yet.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
