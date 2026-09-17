/**
 * Admin invite controls for an EXISTING ambassador record.
 * Reuses: create_ambassador_invite RPC + send-ambassador-invite edge function
 * (via useSendAmbassadorInvite / useResendAmbassadorInvite) and the
 * ambassador_invites table. The invite is always bound to this exact
 * ambassador record via target_ambassador_id, so acceptance reuses the record
 * (tracking code, territory and store assignments preserved).
 *
 * Two render modes:
 *  - `menu`   : DropdownMenu items for a row Actions menu
 *  - `panel`  : compact card section for the profile page
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Send, RefreshCw, CheckCircle2, Clock, AlertTriangle, Mail } from 'lucide-react';
import { DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ambassadorInviteLink } from '@/config/publicUrl';
import { useSendAmbassadorInvite, useResendAmbassadorInvite } from '@/hooks/useAmbassadorInvites';
import type { AmbassadorInviteState } from '@/hooks/useAmbassadorInviteState';

interface Props {
  ambassadorId: string;
  ambassadorName: string;
  /** Ambassador record contact email (business data). */
  email?: string | null;
  phone?: string | null;
  /** Email of the linked authentication account, when one exists. */
  accountEmail?: string | null;
  invite: AmbassadorInviteState;
  mode?: 'menu' | 'panel';
}

export const INVITE_STATE_LABEL: Record<AmbassadorInviteState['state'], string> = {
  linked: 'Account linked',
  pending: 'Invite pending',
  expired: 'Invite expired',
  none: 'Not invited',
};

export function AmbassadorInviteStatusBadge({ state }: { state: AmbassadorInviteState['state'] }) {
  const cfg = {
    linked: { cls: 'bg-emerald-500/15 text-emerald-400 border-0', Icon: CheckCircle2 },
    pending: { cls: 'bg-amber-500/15 text-amber-400 border-0', Icon: Clock },
    expired: { cls: 'bg-destructive/15 text-destructive border-0', Icon: AlertTriangle },
    none: { cls: 'bg-muted text-muted-foreground border-0', Icon: Mail },
  }[state];
  const Icon = cfg.Icon;
  return (
    <Badge variant="outline" className={cfg.cls}>
      <Icon className="h-3 w-3 mr-1" />
      {INVITE_STATE_LABEL[state]}
    </Badge>
  );
}

export function AmbassadorInviteActions({
  ambassadorId,
  ambassadorName,
  email,
  phone,
  accountEmail,
  invite,
  mode = 'menu',
}: Props) {
  const qc = useQueryClient();
  const send = useSendAmbassadorInvite();
  const resend = useResendAmbassadorInvite();
  const [busy, setBusy] = useState(false);

  const busyAll = busy || send.isPending || resend.isPending;

  function refresh() {
    qc.invalidateQueries({ queryKey: ['ambassador-invite-states'] });
    qc.invalidateQueries({ queryKey: ['all-ambassador-invites'] });
  }

  /**
   * Close a leftover open invite for an ambassador whose account is ALREADY
   * linked. The database function re-verifies the invite belongs to that exact
   * ambassador and that the ambassador has a linked login; the row and its
   * history are kept, only marked used.
   */
  async function closeStaleInvite() {
    if (!invite.inviteId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc(
        'close_ambassador_invite_for_linked_account' as any,
        { p_invite_id: invite.inviteId } as any,
      );
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any).error);
      toast.success('Invite marked as used');
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not close the invite');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(token: string) {
    const link = ambassadorInviteLink(token);
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied');
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  }

  /** Contact details fall back to the ambassador record when not passed in. */
  async function resolveContact() {
    if (email || phone) return { email: email || '', phone: phone || '' };
    const { data } = await supabase
      .from('ambassadors')
      .select('email, phone_primary, personal_phone')
      .eq('id', ambassadorId)
      .maybeSingle();
    return {
      email: data?.email || '',
      phone: data?.phone_primary || data?.personal_phone || '',
    };
  }

  /** Create an invite bound to this ambassador record, without requiring delivery. */
  async function createInviteOnly(): Promise<string | null> {
    const contact = await resolveContact();
    if (!contact.email && !contact.phone) {
      toast.error('Add an email or phone to this ambassador first');
      return null;
    }
    const { data, error } = await supabase.rpc('create_ambassador_invite', {
      p_email: contact.email || null,
      p_phone: contact.phone || null,
      p_region_id: null,
      p_target_ambassador_id: ambassadorId,
    } as any);
    if (error) {
      toast.error(error.message);
      return null;
    }
    const r = data as any;
    if (!r?.success) {
      toast.error(r?.error || 'Could not create invite');
      return null;
    }
    return (r.token ?? r.invite_token) as string;
  }

  async function handleCopy() {
    setBusy(true);
    try {
      if (invite.state === 'pending' && invite.token) {
        await copyLink(invite.token);
        return;
      }
      const token = await createInviteOnly();
      if (token) {
        await copyLink(token);
        refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    setBusy(true);
    try {
      const contact = await resolveContact();
      if (!contact.email && !contact.phone) {
        toast.error('Add an email or phone to this ambassador first');
        return;
      }
      const channel = contact.email && contact.phone ? 'both' : contact.email ? 'email' : 'sms';
      await send.mutateAsync({
        name: ambassadorName,
        email: contact.email,
        phone: contact.phone,
        channel,
        targetAmbassadorId: ambassadorId,
      });
      refresh();
    } catch {
      /* toast handled in hook */
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!invite.inviteId) return;
    setBusy(true);
    try {
      await resend.mutateAsync({ inviteId: invite.inviteId, channel: 'both' });
      refresh();
    } catch {
      /* toast handled in hook */
    } finally {
      setBusy(false);
    }
  }

  const canCopy = invite.state !== 'linked';
  const showSend = invite.state === 'none' || invite.state === 'expired';
  const showResend = invite.state === 'pending';

  if (mode === 'panel') {
    const contactEmail = email || null;
    const differs = !!(accountEmail && contactEmail && accountEmail !== contactEmail);
    const inviteDiffers = !!(
      invite.email && invite.email !== contactEmail && invite.email !== accountEmail
    );
    return (
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Invite / Account</span>
              <AmbassadorInviteStatusBadge state={invite.state} />
            </div>
            {invite.state === 'pending' && invite.expiresAt && (
              <span className="text-xs text-muted-foreground">
                Expires {new Date(invite.expiresAt).toLocaleDateString()}
              </span>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {canCopy && (
                <Button size="sm" variant="outline" disabled={busyAll} onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Invite Link
                </Button>
              )}
              {showSend && (
                <Button size="sm" disabled={busyAll} onClick={handleSend}>
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Send Invite
                </Button>
              )}
              {showResend && (
                <Button size="sm" variant="outline" disabled={busyAll} onClick={handleResend}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Resend Invite
                </Button>
              )}
            </div>
          </div>

          {/* Identity clarity: contact vs account vs invite destination */}
          {(contactEmail || accountEmail || invite.email) && (
            <div className="grid gap-1 text-xs">
              {contactEmail && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Contact email</span>
                  <span className="truncate">{contactEmail}</span>
                </div>
              )}
              {accountEmail && (differs || !contactEmail) && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Account email</span>
                  <span className="truncate">{accountEmail}</span>
                </div>
              )}
              {inviteDiffers && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Invite sent to</span>
                  <span className="truncate">{invite.email}</span>
                </div>
              )}
            </div>
          )}

          {invite.staleInvite && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-amber-400 flex-1 min-w-[16rem]">
                A sign-up invite is still open (expires{' '}
                {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : '—'}). The account is
                already linked, so that link is no longer needed.
              </p>
              <Button size="sm" variant="outline" disabled={busyAll} onClick={closeStaleInvite}>
                Mark invite as used
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {INVITE_STATE_LABEL[invite.state]}
        {invite.state === 'pending' && invite.expiresAt
          ? ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}`
          : ''}
      </DropdownMenuLabel>
      {canCopy && (
        <DropdownMenuItem
          disabled={busyAll}
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy Invite Link
        </DropdownMenuItem>
      )}
      {showSend && (
        <DropdownMenuItem
          disabled={busyAll}
          onClick={(e) => { e.stopPropagation(); handleSend(); }}
        >
          <Send className="h-4 w-4 mr-2" />
          Send Invite
        </DropdownMenuItem>
      )}
      {showResend && (
        <DropdownMenuItem
          disabled={busyAll}
          onClick={(e) => { e.stopPropagation(); handleResend(); }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Resend Invite
        </DropdownMenuItem>
      )}
    </>
  );
}

export default AmbassadorInviteActions;
