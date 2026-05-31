import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

type Row = {
  layer: string;
  provider: string;
  target: string;
  status: 'pass' | 'warn' | 'fail';
  message: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

const LAYER_LABELS: Record<string, string> = {
  credentials: '1. Credentials & Balance',
  webhook_config: '2. Webhook Config',
  function_deployment: '3. Function Deployment',
  a2p_sending: '4. A2P / Sending',
  signature_verify: '5. Signature Verify',
  synthetic_loop: '6. Synthetic Loop (24h)',
};
const LAYER_ORDER = Object.keys(LAYER_LABELS);

const StatusIcon = ({ s }: { s: Row['status'] }) =>
  s === 'pass' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
  s === 'warn' ? <AlertTriangle className="w-4 h-4 text-yellow-500" /> :
  <XCircle className="w-4 h-4 text-red-500" />;

const StatusBadge = ({ s }: { s: Row['status'] }) => (
  <Badge variant={s === 'pass' ? 'default' : s === 'warn' ? 'secondary' : 'destructive'}>
    {s.toUpperCase()}
  </Badge>
);

export default function CommsHealthDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_comms_health_latest' as any)
      .select('*')
      .order('layer')
      .order('target');
    if (error) {
      toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
    } else {
      setRows(((data as unknown) as Row[]) || []);
      setLastRefresh(new Date());
    }
    setLoading(false);
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('comms-health-monitor', { body: {} });
    setRunning(false);
    if (error) {
      toast({ title: 'Health check failed', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: data?.ok ? 'All systems green' : `${data?.fail || 0} failing, ${data?.warn || 0} warning`,
        description: `${data?.total || 0} checks in ${data?.duration_ms || 0}ms`,
      });
      await load();
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = LAYER_ORDER.map((layer) => ({
    layer,
    items: rows.filter((r) => r.layer === layer),
  }));
  const totalFail = rows.filter((r) => r.status === 'fail').length;
  const totalWarn = rows.filter((r) => r.status === 'warn').length;
  const totalPass = rows.filter((r) => r.status === 'pass').length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comms Health</h1>
          <p className="text-sm text-muted-foreground">
            Six-layer continuous monitor for Twilio comms. Catches credential, webhook, deployment, A2P, signature, and end-to-end loop failures.
            {lastRefresh && ` Last refreshed ${formatDistanceToNow(lastRefresh)} ago.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            {running ? 'Running…' : 'Run Check Now'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-6"><div className="text-3xl font-bold text-green-500">{totalPass}</div><div className="text-xs text-muted-foreground">Passing</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-3xl font-bold text-yellow-500">{totalWarn}</div><div className="text-xs text-muted-foreground">Warning</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-3xl font-bold text-red-500">{totalFail}</div><div className="text-xs text-muted-foreground">Failing</div></CardContent></Card>
      </div>

      {grouped.map(({ layer, items }) => {
        const layerStatus: Row['status'] = items.some((i) => i.status === 'fail') ? 'fail'
          : items.some((i) => i.status === 'warn') ? 'warn' : 'pass';
        return (
          <Card key={layer}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <StatusIcon s={layerStatus} />
                {LAYER_LABELS[layer]}
                <span className="text-xs text-muted-foreground font-normal">
                  ({items.filter((i) => i.status === 'pass').length}/{items.length} OK)
                </span>
              </CardTitle>
              <StatusBadge s={layerStatus} />
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet. Click "Run Check Now".</p>
              ) : (
                <div className="space-y-1">
                  {items
                    .sort((a, b) => (a.status === b.status ? a.target.localeCompare(b.target) : a.status === 'fail' ? -1 : b.status === 'fail' ? 1 : a.status === 'warn' ? -1 : 1))
                    .map((r) => (
                      <div key={`${r.layer}-${r.target}`} className={`text-sm flex items-start gap-3 p-2 rounded ${r.status === 'fail' ? 'bg-red-500/10' : r.status === 'warn' ? 'bg-yellow-500/10' : 'bg-muted/30'}`}>
                        <StatusIcon s={r.status} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs font-semibold">{r.target}</div>
                          {r.message && <div className="text-xs text-muted-foreground mt-0.5">{r.message}</div>}
                        </div>
                        <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
