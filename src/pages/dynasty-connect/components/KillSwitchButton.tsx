/**
 * Dynasty Connect — Emergency Stop Button
 *
 * Hard-to-misclick kill-switch toggle. Reads/writes public.kill_switch_state.
 * Scope is either:
 *   - { campaignId } — stops a single dc_campaigns row mid-flight
 *   - { businessUnitKey } — stops ALL dialing for a business unit (nuclear)
 *
 * UX guarantees:
 *   - Both ENGAGE and RELEASE require typing `dynasty_direct` in a custom modal
 *     (no native confirm(), no single-click footguns)
 *   - Engage modal = destructive red theme
 *   - Release modal = success green theme
 *   - State badge reflects DB truth:
 *       is_active = true  → ACTIVE (red)
 *       is_active = false → INACTIVE (green)
 *   - Auto-refetches after any mutation + 5s poll
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldAlert, ShieldCheck, Octagon, CheckCircle2 } from 'lucide-react';

type KillSwitchScope =
  | { kind: 'campaign'; campaignId: string; label: string }
  | { kind: 'business_unit'; businessUnitKey: string; label: string };

interface Props {
  scope: KillSwitchScope;
  /** 'compact' for table rows, 'banner' for nuclear top-of-page bar */
  variant?: 'compact' | 'banner';
}

const CONFIRM_PHRASE = 'dynasty_direct';

export default function KillSwitchButton({ scope, variant = 'compact' }: Props) {
  const qc = useQueryClient();
  const [engageOpen, setEngageOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');

  const queryKey = scope.kind === 'campaign'
    ? ['kill-switch', 'campaign', scope.campaignId]
    : ['kill-switch', 'business_unit', scope.businessUnitKey];

  const { data: activeSwitch } = useQuery({
    queryKey,
    refetchInterval: 5000,
    queryFn: async () => {
      const q = (supabase as any).from('kill_switch_state').select('*').eq('is_active', true).limit(1);
      const filtered = scope.kind === 'campaign'
        ? q.eq('campaign_id', scope.campaignId)
        : q.eq('business_unit_key', scope.businessUnitKey);
      const { data } = await filtered.maybeSingle();
      return data || null;
    },
  });

  const isActive = !!activeSwitch;

  const resetForm = () => {
    setConfirmText('');
    setReason('');
  };

  const engage = useMutation({
    mutationFn: async () => {
      const payload: any = {
        scope: scope.kind,
        is_active: true,
        triggered_at: new Date().toISOString(),
        trigger_reason: reason || 'Manual emergency stop from UI',
        requires_manual_reset: true,
      };
      if (scope.kind === 'campaign') payload.campaign_id = scope.campaignId;
      else payload.business_unit_key = scope.businessUnitKey;

      const { error } = await (supabase as any).from('kill_switch_state').insert(payload);
      if (error) throw error;

      try {
        await supabase.functions.invoke('dc-log-compliance-event', {
          body: {
            event_type: 'kill_switch_engaged',
            business_unit_key: scope.kind === 'business_unit' ? scope.businessUnitKey : null,
            actor: 'manual_admin',
            event_data: {
              trigger_reason: reason || 'Manual emergency stop from UI',
              requires_manual_reset: true,
              previous_state: 'inactive',
              scope: scope.kind,
              ...(scope.kind === 'campaign' ? { campaign_id: scope.campaignId, campaign_label: scope.label } : {}),
            },
          },
        });
      } catch (e) {
        console.error('[KillSwitchButton] compliance log failed (non-fatal)', e);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
      await qc.refetchQueries({ queryKey });
      toast.success(`Kill-switch ENGAGED for ${scope.label}`);
      setEngageOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(`Kill-switch failed: ${e.message}`),
  });

  const release = useMutation({
    mutationFn: async () => {
      if (!activeSwitch?.id) throw new Error('No active kill-switch found');
      const { error } = await (supabase as any).from('kill_switch_state').update({
        is_active: false,
        reset_at: new Date().toISOString(),
      }).eq('id', activeSwitch.id);
      if (error) throw error;

      try {
        await supabase.functions.invoke('dc-log-compliance-event', {
          body: {
            event_type: 'kill_switch_released',
            business_unit_key: scope.kind === 'business_unit' ? scope.businessUnitKey : null,
            actor: 'manual_admin',
            event_data: {
              previous_state: 'active',
              released_at: new Date().toISOString(),
              release_reason: reason || 'Manual release from UI',
              scope: scope.kind,
              ...(scope.kind === 'campaign' ? { campaign_id: scope.campaignId, campaign_label: scope.label } : {}),
            },
          },
        });
      } catch (e) {
        console.error('[KillSwitchButton] compliance log failed (non-fatal)', e);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
      await qc.refetchQueries({ queryKey });
      toast.success(`Kill-switch released for ${scope.label} — dispatch resumed`);
      setReleaseOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(`Release failed: ${e.message}`),
  });

  const canFire = confirmText.trim() === CONFIRM_PHRASE;

  return (
    <div className={variant === 'banner' ? 'flex items-center gap-3' : 'flex items-center gap-2'}>
      {/* Status badge — DB truth */}
      {isActive ? (
        <Badge variant="destructive" className="gap-1">
          <Octagon className="h-3 w-3" /> ACTIVE
        </Badge>
      ) : (
        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white border-transparent">
          <CheckCircle2 className="h-3 w-3" /> INACTIVE
        </Badge>
      )}

      {/* Action button */}
      {isActive ? (
        <Button
          size={variant === 'banner' ? 'default' : 'sm'}
          className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => { resetForm(); setReleaseOpen(true); }}
          disabled={release.isPending}
        >
          <ShieldCheck className="h-4 w-4" />
          {release.isPending ? 'Releasing…' : 'Release'}
        </Button>
      ) : (
        <Button
          variant="destructive"
          size={variant === 'banner' ? 'default' : 'sm'}
          onClick={() => { resetForm(); setEngageOpen(true); }}
          className="gap-1"
        >
          <ShieldAlert className="h-4 w-4" />
          {variant === 'banner' ? `Emergency Stop ${scope.label}` : 'Stop'}
        </Button>
      )}

      {/* ENGAGE modal — RED */}
      <Dialog open={engageOpen} onOpenChange={(o) => { setEngageOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="border-destructive/60 border-2">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Engage Kill-Switch
            </DialogTitle>
            <DialogDescription>
              This will immediately block all new dialing for{' '}
              <strong>{scope.label}</strong>
              {scope.kind === 'business_unit' && ' (every campaign in this unit)'}.
              {' '}In-flight calls are not cancelled — only new dispatch is blocked.
              Manual release required to resume.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">
                Type <code className="bg-destructive/10 text-destructive px-1 rounded font-mono">{CONFIRM_PHRASE}</code> to confirm
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Reason (optional, logged for audit)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. compliance review, bad agent prompt, billing pause"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEngageOpen(false); resetForm(); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!canFire || engage.isPending}
              onClick={() => engage.mutate()}
            >
              {engage.isPending ? 'Engaging…' : 'ENGAGE KILL-SWITCH'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RELEASE modal — GREEN */}
      <Dialog open={releaseOpen} onOpenChange={(o) => { setReleaseOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="border-emerald-600/60 border-2">
          <DialogHeader>
            <DialogTitle className="text-emerald-600 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Release Kill-Switch
            </DialogTitle>
            <DialogDescription>
              This will resume dispatch for <strong>{scope.label}</strong>
              {scope.kind === 'business_unit' && ' (every campaign in this unit)'}.
              {' '}New calls will begin flowing again immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">
                Type <code className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 px-1 rounded font-mono">{CONFIRM_PHRASE}</code> to confirm
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Reason (optional, logged for audit)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. issue resolved, resuming normal ops"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReleaseOpen(false); resetForm(); }}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!canFire || release.isPending}
              onClick={() => release.mutate()}
            >
              {release.isPending ? 'Releasing…' : 'CONFIRM RELEASE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
