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
  credentials: 'Credentials & Balance',
  webhook_config: 'Webhook Config',
  function_deployment: 'Function Deployment',
  a2p_sending: 'A2P / Sending',
  signature_verify: 'Signature Verify',
  synthetic_loop: 'Synthetic Loop (24h)',
};

const PROVIDERS: { id: string; label: string; layers: string[] }[] = [
  {
    id: 'twilio',
    label: 'Twilio SMS / Voice',
    layers: ['credentials', 'webhook_config', 'function_deployment', 'a2p_sending', 'signature_verify', 'synthetic_loop'],
  },
  {
    id: 'bland',
    label: 'Bland AI (outbound + inbound calling)',
    layers: ['credentials', 'function_deployment', 'synthetic_loop'],
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs (TTS + Convai)',
    layers: ['credentials', 'webhook_config'],
  },
];

const StatusIcon = ({ s }: { s: Row['status'] }) =>
  s === 'pass' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
  s === 'warn' ? <AlertTriangle className="w-4 h-4 text-yellow-500" /> :
  <XCircle className="w-4 h-4 text-red-500" />;

const StatusBadge = ({ s }: { s: Row['status'] }) => (
  <Badge variant={s === 'pass' ? 'default' : s === 'warn' ? 'secondary' : 'destructive'}>
    {s.toUpperCase()}
  </Badge>
);

function rollup(items: Row[]): Row['status'] {
  if (items.some((i) => i.status === 'fail')) return 'fail';
  if (items.some((i) => i.status === 'warn')) return 'warn';
  return 'pass';
}

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

  const totalFail = rows.filter((r) => r.status === 'fail').length;
  const totalWarn = rows.filter((r) => r.status === 'warn').length;
  const totalPass = rows.filter((r) => r.status === 'pass').length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comms Health</h1>
          <p className="text-sm text-muted-foreground">
            Continuous monitor for Twilio (SMS/voice), Bland AI (calling), and ElevenLabs (TTS + Convai). Catches credential, webhook, deployment, A2P, signature, balance, and end-to-end loop failures.
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

      {PROVIDERS.map((provider) => {
        const providerRows = rows.filter((r) => r.provider === provider.id);
        const providerStatus = providerRows.length === 0 ? 'warn' : rollup(providerRows);
        return (
          <div key={provider.id} className="space-y-3">
            <div className="flex items-center gap-2 border-b pb-2">
              <StatusIcon s={providerStatus} />
              <h2 className="text-lg font-semibold">{provider.label}</h2>
              <StatusBadge s={providerStatus} />
              <span className="text-xs text-muted-foreground ml-auto">
                {providerRows.filter((r) => r.status === 'pass').length}/{providerRows.length} OK
              </span>
            </div>

            {provider.layers.map((layer) => {
              const items = providerRows.filter((r) => r.layer === layer);
              if (items.length === 0) return null;
              const layerStatus = rollup(items);
              return (
                <Card key={`${provider.id}-${layer}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <StatusIcon s={layerStatus} />
                      {LAYER_LABELS[layer] || layer}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({items.filter((i) => i.status === 'pass').length}/{items.length} OK)
                      </span>
                    </CardTitle>
                    <StatusBadge s={layerStatus} />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {items
                        .sort((a, b) => (a.status === b.status ? a.target.localeCompare(b.target) : a.status === 'fail' ? -1 : b.status === 'fail' ? 1 : a.status === 'warn' ? -1 : 1))
                        .map((r) => (
                          <div key={`${r.provider}-${r.layer}-${r.target}`} className={`text-sm flex items-start gap-3 p-2 rounded ${r.status === 'fail' ? 'bg-red-500/10' : r.status === 'warn' ? 'bg-yellow-500/10' : 'bg-muted/30'}`}>
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
                  </CardContent>
                </Card>
              );
            })}

            {providerRows.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No data yet for this provider. Click "Run Check Now".</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
