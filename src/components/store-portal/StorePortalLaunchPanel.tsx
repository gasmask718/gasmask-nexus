import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { LAUNCH_CHECKLIST } from '@/lib/storePortal';

/** Owner-only launch lock for the store portal + the 8-step owner test checklist. */
export function StorePortalLaunchPanel() {
  const qc = useQueryClient();
  const { roles } = useUserRole();
  const canEdit = (roles as string[]).some((r) => r === 'owner' || r === 'admin');
  const { data, isLoading } = useQuery({
    queryKey: ['store-portal-launch'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('store_portal_launch_state');
      if (error) throw error;
      return data as { live: boolean; checklist: Record<string, boolean> };
    },
  });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  useEffect(() => { if (data) setChecklist(data.checklist || {}); }, [data]);

  const save = useMutation({
    mutationFn: async (v: { live: boolean; checklist: Record<string, boolean> }) => {
      const { data, error } = await (supabase as any).rpc('set_store_portal_launch', { p_live: v.live, p_checklist: v.checklist });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store-portal-launch'] }),
    onError: (e: any) => {
      toast.error(e.message || String(e));
      qc.invalidateQueries({ queryKey: ['store-portal-launch'] });
    },
  });

  const live = !!data?.live;
  const allDone = LAUNCH_CHECKLIST.every((s) => checklist[s.key]);

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-3 text-lg">
          <Lock className="h-5 w-5" /> Store portal live
          <Badge variant={live ? 'default' : 'secondary'}>{live ? 'ON' : 'OFF'}</Badge>
          <Switch
            checked={live}
            disabled={!canEdit || isLoading || save.isPending || (!live && !allDone)}
            onCheckedChange={(v) => save.mutate({ live: v, checklist })}
            aria-label="Store portal live"
          />
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          While OFF, portal links and delivery texts only go to the test store. {canEdit ? 'Check every test step to unlock the switch.' : 'Only the owner can change this.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {LAUNCH_CHECKLIST.map((s, i) => (
          <label key={s.key} className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={!!checklist[s.key]}
              disabled={!canEdit || save.isPending}
              onCheckedChange={(v) => {
                const next = { ...checklist, [s.key]: !!v };
                setChecklist(next);
                // Unchecking a step while live is allowed to be saved only as OFF? Keep current live state; server refuses ON with gaps.
                save.mutate({ live: live && Object.values(next).filter(Boolean).length === LAUNCH_CHECKLIST.length, checklist: next });
              }}
            />
            <span>{i + 1}. {s.label}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
