/**
 * PublicSiteToggleCard — admin control to opt a store into the public
 * GasMask "Where to Buy" locator. Also exposes a bulk-enable action
 * scoped to active stores so David can flip the directory on in one move.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function PublicSiteToggleCard({ storeId }: { storeId: string }) {
  const qc = useQueryClient();

  const { data: store, isLoading } = useQuery({
    queryKey: ['store-public-flag', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('show_on_public_site, status')
        .eq('id', storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from('store_master')
        .update({ show_on_public_site: next })
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-public-flag', storeId] });
      toast.success('Public locator updated (visible within 15 min cache)');
    },
    onError: (e: any) => toast.error(e.message ?? 'Update failed'),
  });

  const enabled = !!store?.show_on_public_site;
  const isActive = store?.status === 'active';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="h-4 w-4" /> Public "Where to Buy" Locator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Show on public site</div>
            <div className="text-xs text-muted-foreground">
              {isActive ? 'Will appear on gasmask.com locator' : 'Only active stores are listed publicly'}
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={isLoading || toggle.isPending || !isActive}
            onCheckedChange={(v) => toggle.mutate(v)}
          />
        </div>
        {toggle.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </CardContent>
    </Card>
  );
}

export function PublicSiteBulkEnableButton() {
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();

  const run = async () => {
    if (!confirm('Enable the public "Where to Buy" listing for ALL active stores?')) return;
    setRunning(true);
    try {
      const { count, error } = await supabase
        .from('store_master')
        .update({ show_on_public_site: true }, { count: 'exact' })
        .eq('status', 'active')
        .is('deleted_at', null)
        .eq('show_on_public_site', false)
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      toast.success(`Enabled ${count ?? 0} active store(s) on public locator`);
      qc.invalidateQueries({ queryKey: ['store-public-flag'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Bulk enable failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={running}>
      {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Globe className="h-3.5 w-3.5 mr-2" />}
      Bulk-enable all active stores
    </Button>
  );
}
