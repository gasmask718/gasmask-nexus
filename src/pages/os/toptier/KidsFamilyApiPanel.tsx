import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plug, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const API_PROVIDERS = [
  { name: 'Viator', endpoint: 'https://api.viator.com/partner', description: 'Tours & activities worldwide' },
  { name: 'GetYourGuide', endpoint: 'https://api.getyourguide.com/1', description: 'European & global experiences' },
  { name: 'Ticketmaster', endpoint: 'https://app.ticketmaster.com/discovery/v2', description: 'Events, shows & family entertainment' },
];

export default function KidsFamilyApiPanel() {
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['kf-api-connections'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kf_api_connections').select('*').order('provider_name');
      if (error) throw error;
      return data || [];
    },
  });

  const initProvider = useMutation({
    mutationFn: async (provider: typeof API_PROVIDERS[0]) => {
      const exists = connections.find((c: any) => c.provider_name === provider.name);
      if (exists) {
        toast.info(`${provider.name} already configured`);
        return;
      }
      const { error } = await supabase.from('kf_api_connections').insert({
        provider_name: provider.name,
        api_endpoint: provider.endpoint,
        status: 'configured',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kf-api-connections'] });
      toast.success('API connection initialized');
    },
  });

  const syncProvider = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kf_api_connections').update({
        last_sync_at: new Date().toISOString(),
        status: 'connected',
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kf-api-connections'] });
      toast.success('Sync triggered');
    },
  });

  const statusConfig: Record<string, { icon: any; color: string }> = {
    connected: { icon: CheckCircle, color: 'text-emerald-400' },
    configured: { icon: Clock, color: 'text-amber-400' },
    disconnected: { icon: AlertTriangle, color: 'text-red-400' },
    error: { icon: AlertTriangle, color: 'text-red-400' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">API Management Panel</h1>
        <p className="text-sm text-white/50">Connect & manage external experience providers</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {API_PROVIDERS.map(provider => {
          const conn = connections.find((c: any) => c.provider_name === provider.name);
          const sc = statusConfig[conn?.status || 'disconnected'];
          const StatusIcon = sc.icon;

          return (
            <Card key={provider.name} className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">{provider.name}</CardTitle>
                  <StatusIcon className={`h-5 w-5 ${sc.color}`} />
                </div>
                <p className="text-xs text-white/40">{provider.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {conn ? (
                  <>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-white/40">Status</span><Badge className={conn.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>{conn.status}</Badge></div>
                      <div className="flex justify-between"><span className="text-white/40">Synced</span><span className="text-white/60">{conn.total_synced || 0} items</span></div>
                      <div className="flex justify-between"><span className="text-white/40">Errors</span><span className={conn.error_count > 0 ? 'text-red-400' : 'text-white/60'}>{conn.error_count || 0}</span></div>
                      {conn.last_sync_at && <div className="flex justify-between"><span className="text-white/40">Last Sync</span><span className="text-white/60">{formatDistanceToNow(new Date(conn.last_sync_at), { addSuffix: true })}</span></div>}
                    </div>
                    <Button size="sm" className="w-full bg-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C]/30" onClick={() => syncProvider.mutate(conn.id)}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Sync Now
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="w-full bg-[#C9A84C] text-black" onClick={() => initProvider.mutate(provider)}>
                    <Plug className="h-3 w-3 mr-1" /> Connect
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {connections.some((c: any) => c.last_error) && (
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader><CardTitle className="text-red-400 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Recent Errors</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {connections.filter((c: any) => c.last_error).map((c: any) => (
              <div key={c.id} className="p-3 bg-red-500/10 rounded-lg">
                <p className="text-white font-medium text-sm">{c.provider_name}</p>
                <p className="text-red-300 text-xs mt-1">{c.last_error}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
