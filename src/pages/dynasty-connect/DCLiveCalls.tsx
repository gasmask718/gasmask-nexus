import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio, Phone } from 'lucide-react';

export default function DCLiveCalls() {
  const { data: liveCalls = [], isLoading } = useQuery({
    queryKey: ['dc-live-calls-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_calls')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 5000,
  });

  const activeCalls = liveCalls.filter((c: any) => c.status === 'active');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Radio className="h-6 w-6" /> Live Calls
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeCalls.length} active · {liveCalls.length} total in history
        </p>
      </div>

      {activeCalls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No live calls right now</p>
            <p className="text-xs">Active calls will appear here in real-time</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeCalls.map((call: any) => (
            <Card key={call.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                    <div>
                      <p className="font-medium text-sm">{call.call_sid || call.provider_call_sid || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        Started: {new Date(call.started_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500 border-green-500">Live</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent completed */}
      {liveCalls.filter((c: any) => c.status !== 'active').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {liveCalls.filter((c: any) => c.status !== 'active').slice(0, 10).map((call: any) => (
              <div key={call.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                <span className="font-mono text-xs">{call.call_sid || call.provider_call_sid || '—'}</span>
                <Badge variant="outline">{call.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
