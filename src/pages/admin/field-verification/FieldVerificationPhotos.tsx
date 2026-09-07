import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, Flag, Images, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { SignedImage } from '@/components/ui/signed-image';
import { verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import {
  useCrewDrops, useCrewProfiles, crewNameMap, computeDuplicateIds, DROP_TYPE_LABEL, DROP_TYPE_COLOR,
} from '@/hooks/useFieldVerification';

export default function FieldVerificationPhotos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: drops, isLoading, error } = useCrewDrops();
  const { data: profiles } = useCrewProfiles();
  const names = useMemo(() => crewNameMap(profiles), [profiles]);
  const rateByCrew = useMemo(() => {
    const m = new Map<string, number>();
    (profiles ?? []).forEach((p) => m.set(p.user_id, Number(p.rate_per_drop ?? 0)));
    return m;
  }, [profiles]);

  const [statusFilter, setStatusFilter] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const duplicates = useMemo(() => computeDuplicateIds(drops ?? []), [drops]);
  const rows = useMemo(
    () => (drops ?? []).filter((d) => statusFilter === 'all' || d.status === statusFilter),
    [drops, statusFilter],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ['fv-crew-drops'] });

  const approve = async (id: string, crewId: string) => {
    setBusyId(id);
    try {
      // rate looked up at approval time from the crew member's current profile
      const { data: prof, error: profErr } = await supabase
        .from('crew_profiles')
        .select('rate_per_drop')
        .eq('user_id', crewId)
        .maybeSingle();
      if (profErr) throw profErr;
      const rate = Number(prof?.rate_per_drop ?? rateByCrew.get(crewId) ?? 0);

      await verifiedUpdate('approve field drop', () =>
        supabase
          .from('crew_drops')
          .update({
            status: 'verified',
            verified_by: user?.id ?? null,
            verified_at: new Date().toISOString(),
            earnings: rate,
          })
          .eq('id', id),
      );
      toast.success(`Approved — $${rate.toFixed(2)} credited`);
      refresh();
    } catch (e) {
      toast.error(mutationErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const flag = async (id: string) => {
    const reason = window.prompt('Why is this drop being rejected?')?.trim();
    if (!reason) return;
    setBusyId(id);
    try {
      await verifiedUpdate('flag field drop', () =>
        supabase.from('crew_drops').update({ status: 'rejected', flag_reason: reason }).eq('id', id),
      );
      toast.success('Drop flagged');
      refresh();
    } catch (e) {
      toast.error(mutationErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Images className="h-6 w-6 text-primary" /> Photo Feed</h1>
          <p className="text-sm text-muted-foreground">Newest drops first. Approve or flag each one.</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>}
      {error && <Card><CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent></Card>}
      {!isLoading && !error && rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No drops to show.</CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((d) => (
          <Card key={d.id} className="overflow-hidden">
            <SignedImage
              bucket="crew-drop-photos"
              path={d.photo_path}
              alt={`${DROP_TYPE_LABEL[d.drop_type] ?? d.drop_type} photo`}
              className="w-full h-56 object-cover"
              fallback={<div className="w-full h-56 bg-muted flex items-center justify-center text-xs text-muted-foreground">Photo unavailable</div>}
            />
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{names.get(d.crew_id) ?? 'Unknown crew'}</span>
                <Badge variant={d.status === 'verified' ? 'default' : d.status === 'rejected' ? 'destructive' : 'secondary'}>{d.status}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" style={{ borderColor: DROP_TYPE_COLOR[d.drop_type] }}>
                  {DROP_TYPE_LABEL[d.drop_type] ?? d.drop_type}
                </Badge>
                {duplicates.has(d.id) && (
                  <Badge variant="outline" className="border-amber-500 text-amber-500 gap-1">
                    <AlertTriangle className="h-3 w-3" /> Possible duplicate
                  </Badge>
                )}
              </div>
              {d.store_name && <div><span className="text-muted-foreground">Store: </span>{d.store_name}</div>}
              <div className="text-xs text-muted-foreground">
                {d.latitude != null && d.longitude != null ? `${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}` : 'No GPS'}
                {d.accuracy_m != null && ` · ±${Math.round(d.accuracy_m)}m`}
                <br />
                {d.server_timestamp ? new Date(d.server_timestamp).toLocaleString() : '—'}
              </div>
              {d.notes && <p className="text-muted-foreground italic">“{d.notes}”</p>}
              {d.flag_reason && <p className="text-destructive text-xs">Flagged: {d.flag_reason}</p>}
              {d.status === 'verified' && (
                <p className="text-xs text-muted-foreground">Earned ${Number(d.earnings ?? 0).toFixed(2)}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1" disabled={busyId === d.id || d.status === 'verified'} onClick={() => approve(d.id, d.crew_id)}>
                  {busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Approve</>}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" disabled={busyId === d.id || d.status === 'rejected'} onClick={() => flag(d.id)}>
                  <Flag className="h-4 w-4 mr-1" /> Flag
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
