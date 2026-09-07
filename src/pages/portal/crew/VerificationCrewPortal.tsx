import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import NewDropForm from '@/components/portal/crew/NewDropForm';
import CrewDropsMap from '@/components/portal/crew/CrewDropsMap';

const money = (n: number) => `$${n.toFixed(2)}`;

export default function VerificationCrewPortal() {
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['crew-profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew_profiles')
        .select('id, full_name, status, rate_per_drop, zone_id, crew_zones:zone_id(id, name, city, state, target_drops)')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: drops, isLoading: dropsLoading } = useQuery({
    queryKey: ['crew-drops', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew_drops')
        .select('id, drop_type, store_name, status, earnings, latitude, longitude, server_timestamp, notes')
        .eq('crew_id', user!.id)
        .order('server_timestamp', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const rows = drops ?? [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - 7 * 86400000;
    const ts = (r: { server_timestamp: string | null }) => (r.server_timestamp ? new Date(r.server_timestamp).getTime() : 0);
    return {
      today: rows.filter(r => ts(r) >= startOfDay).length,
      week: rows.filter(r => ts(r) >= weekAgo).length,
      total: rows.length,
      earnings: rows.reduce((s, r) => s + Number(r.earnings ?? 0), 0),
      verified: rows.filter(r => r.status === 'verified').length,
    };
  }, [drops]);

  const zone = (profile as { crew_zones?: { name: string; city: string | null; state: string | null; target_drops: number | null } | null } | null)?.crew_zones ?? null;
  const zonePct = zone?.target_drops ? Math.min(100, Math.round((stats.total / zone.target_drops) * 100)) : null;

  if (profileLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="h-6 w-6 animate-spin text-destructive" /></div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-destructive/40 px-4 py-3">
        <h1 className="text-lg font-bold tracking-wide text-destructive">GASMASK FIELD CREW</h1>
        <p className="text-xs text-white/60">
          {profile?.full_name || 'Crew member'}
          {zone ? ` · ${zone.name}` : ''}
          {profile?.status && profile.status !== 'active' ? ` · ${profile.status}` : ''}
        </p>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        <Tabs defaultValue="new">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="new">New drop</TabsTrigger>
            <TabsTrigger value="me">My work</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4">
            {profile?.status === 'active' || !profile ? (
              <NewDropForm zoneId={profile?.zone_id ?? null} />
            ) : (
              <Card><CardContent className="p-6 text-sm text-white/70">Your crew account is {profile.status}. Ask your manager to reactivate it before logging drops.</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="me" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Today', value: stats.today },
                { label: 'This week', value: stats.week },
                { label: 'All drops', value: stats.total },
                { label: 'Earnings', value: money(stats.earnings) },
              ].map(s => (
                <Card key={s.label} className="bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <p className="text-xs text-white/60">{s.label}</p>
                    <p className="text-2xl font-bold text-destructive">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {zone && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2"><CardTitle className="text-sm">My zone · {zone.name}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {zonePct !== null ? (
                    <>
                      <Progress value={zonePct} />
                      <p className="text-xs text-white/60">{stats.total} of {zone.target_drops} target drops ({zonePct}%)</p>
                    </>
                  ) : (
                    <p className="text-xs text-white/60">No target set for this zone yet.</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm">My map</CardTitle></CardHeader>
              <CardContent><CrewDropsMap points={(drops ?? []).map(d => ({ id: d.id, latitude: d.latitude, longitude: d.longitude, drop_type: d.drop_type }))} /></CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recent drops</CardTitle></CardHeader>
              <CardContent className="divide-y divide-white/10">
                {dropsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {(drops ?? []).slice(0, 25).map(d => (
                  <div key={d.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="capitalize">{d.drop_type.replace('_', ' ')}{d.store_name ? ` · ${d.store_name}` : ''}</p>
                      <p className="text-xs text-white/50">{d.server_timestamp ? new Date(d.server_timestamp).toLocaleString() : ''}</p>
                    </div>
                    <Badge variant={d.status === 'verified' ? 'default' : d.status === 'rejected' ? 'destructive' : 'secondary'}>
                      {d.status}
                    </Badge>
                  </div>
                ))}
                {!dropsLoading && (drops ?? []).length === 0 && <p className="py-3 text-sm text-white/60">No drops logged yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
