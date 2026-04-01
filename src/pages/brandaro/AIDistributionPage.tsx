import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AIDistributionPage() {
  const { toast } = useToast();
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [result, setResult] = useState<{ assigned: number; va_count: number } | null>(null);

  const runDistribution = async () => {
    setDistributing(true);
    setResult(null);

    const { data, error } = await supabase.rpc('distribute_leads_to_vas');

    if (error) {
      toast({ title: 'Distribution failed', description: error.message, variant: 'destructive' });
    } else {
      const res = data as any;
      setResult(res);
      if (res.error) {
        toast({ title: 'No VAs available', description: res.error, variant: 'destructive' });
      } else {
        toast({
          title: 'Distribution complete',
          description: `${res.assigned} leads distributed across ${res.va_count} VAs`,
        });
      }
    }
    setDistributing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" /> Automated AI Distribution
        </h1>
        <p className="text-sm text-muted-foreground">
          Smart load-balanced lead assignment across all active VAs
        </p>
      </div>

      {/* Toggle Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Auto-Distribution Mode</CardTitle>
              <CardDescription>
                When enabled, new unassigned leads will be auto-distributed on trigger
              </CardDescription>
            </div>
            <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
          </div>
        </CardHeader>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> How Distribution Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Badge className="bg-primary/20 text-primary text-xs shrink-0 mt-0.5">1</Badge>
            <p>System identifies all unassigned leads, sorted by priority score (HOT first)</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-primary/20 text-primary text-xs shrink-0 mt-0.5">2</Badge>
            <p>Active VAs are ranked by current lead count (lowest load first)</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-primary/20 text-primary text-xs shrink-0 mt-0.5">3</Badge>
            <p>Leads are round-robin distributed starting with the least-loaded VA</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-primary/20 text-primary text-xs shrink-0 mt-0.5">4</Badge>
            <p>Each VA sees only their assigned leads — no access to the master list</p>
          </div>
        </CardContent>
      </Card>

      {/* Manual Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run Distribution Now</CardTitle>
          <CardDescription>
            Manually trigger the distribution engine to assign all unassigned leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={runDistribution}
            disabled={distributing}
            className="gap-2"
            size="lg"
          >
            {distributing ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Distributing...</>
            ) : (
              <><Zap className="h-4 w-4" /> Distribute Leads Now</>
            )}
          </Button>

          {result && !result.error && (
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              {result.assigned} leads distributed across {result.va_count} VAs
            </div>
          )}

          {result?.error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {(result as any).error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
