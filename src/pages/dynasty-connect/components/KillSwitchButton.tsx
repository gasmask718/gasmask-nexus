/**
 * Dynasty Connect — Emergency Stop Button
 *
 * Hard-to-misclick kill-switch toggle. Reads/writes public.kill_switch_state.
 * Scope is either:
 *   - { campaignId } — stops a single dc_campaigns row mid-flight
 *   - { businessUnitKey } — stops ALL dialing for a business unit (nuclear)
 *
 * UX guarantees:
 *   - Engaging requires typing the campaign name / unit key in a confirm modal
 *     (no single-click footguns)
 *   - Disengaging requires a separate confirmation
 *   - Live status indicator queried every 5s
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
import { ShieldAlert, Octagon } from 'lucide-react';

type KillSwitchScope =
  | { kind: 'campaign'; campaignId: string; label: string }
  | { kind: 'business_unit'; businessUnitKey: string; label: string };

interface Props {
  scope: KillSwitchScope;
  /** 'compact' for table rows, 'banner' for nuclear top-of-page bar */
  variant?: 'compact' | 'banner';
}

export default function KillSwitchButton({ scope, variant = 'compact' }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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

      // Fire-and-forget immutable compliance audit event.
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

    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success(`Kill-switch ENGAGED for ${scope.label}`);
      setOpen(false);
      setConfirmText('');
      setReason('');
    },
    onError: (e: any) => toast.error(`Kill-switch failed: ${e.message}`),
  });

  const release = useMutation({
    mutationFn: async () => {
      if (!activeSwitch?.id) return;
      const { error } = await (supabase as any).from('kill_switch_state').update({
        is_active: false,
        reset_at: new Date().toISOString(),
      }).eq('id', activeSwitch.id);
      if (error) throw error;

      // Fire-and-forget immutable compliance audit event.
      try {
        await supabase.functions.invoke('dc-log-compliance-event', {
          body: {
            event_type: 'kill_switch_released',
            business_unit_key: scope.kind === 'business_unit' ? scope.businessUnitKey : null,
            actor: 'manual_admin',
            event_data: {
              previous_state: 'active',
              released_at: new Date().toISOString(),
              scope: scope.kind,
              ...(scope.kind === 'campaign' ? { campaign_id: scope.campaignId, campaign_label: scope.label } : {}),
            },
          },
        });
      } catch (e) {
        console.error('[KillSwitchButton] compliance log failed (non-fatal)', e);
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success(`Kill-switch released for ${scope.label}`);
    },
    onError: (e: any) => toast.error(`Release failed: ${e.message}`),
  });

  // Currently engaged → show RELEASE control
  if (activeSwitch) {
    return (
      <div className={variant === 'banner' ? 'flex items-center gap-3' : 'flex items-center gap-2'}>
        <Badge variant="destructive" className="gap-1">
          <Octagon className="h-3 w-3" /> KILLED
        </Badge>
        <Button
          variant="outline" size="sm"
          onClick={() => {
            if (confirm(`Release kill-switch for ${scope.label}? Dispatch will resume.`)) {
              release.mutate();
            }
          }}
          disabled={release.isPending}
        >
          {release.isPending ? 'Releasing…' : 'Release'}
        </Button>
      </div>
    );
  }

  // Not engaged → show ENGAGE control with typed-confirmation modal
  const expected = scope.kind === 'campaign' ? scope.label : scope.businessUnitKey;
  const canFire = confirmText.trim() === expected;

  return (
    <>
      <Button
        variant="destructive"
        size={variant === 'banner' ? 'default' : 'sm'}
        onClick={() => setOpen(true)}
        className="gap-1"
      >
        <ShieldAlert className="h-4 w-4" />
        {variant === 'banner' ? `Emergency Stop ${scope.label}` : 'Stop'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
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
                Type <code className="bg-muted px-1 rounded">{expected}</code> to confirm
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expected}
                autoComplete="off"
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
            <Button variant="ghost" onClick={() => { setOpen(false); setConfirmText(''); }}>Cancel</Button>
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
    </>
  );
}
