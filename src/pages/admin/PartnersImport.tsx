import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Admin tool: paste JSON array of partners (with nested vehicles), dry-run, then commit.
// CSV upload can be layered on later; JSON is the canonical shape the edge function accepts.
const SAMPLE = JSON.stringify(
  [
    {
      business_name: 'SEED_TEST Exotic Garage LA',
      contact_name: 'Jane Doe',
      phone: '+13105550101',
      email: 'seed-test-exotic@example.com',
      partner_type: 'exotic_supplier',
      service_regions: ['CA'],
      vehicles: [
        {
          name: 'SEED_TEST Lamborghini Huracan',
          vehicle_class: 'exotic',
          style: 'luxury',
          color: 'red',
          star_ceiling: false,
          red_carpet: false,
          dispatch_model: 'asset_fallback',
          partner_cost: 800,
          markup_pct: 35,
        },
      ],
    },
    {
      business_name: 'SEED_TEST Sprinter Fleet NY',
      phone: '+12125550102',
      email: 'seed-test-sprinter@example.com',
      partner_type: 'sprinter_operator',
      service_regions: ['NY'],
      default_partner_cost: 250,
      default_markup_pct: 40,
    },
    {
      business_name: 'SEED_TEST Jet Broker',
      phone: '+12125550103',
      email: 'seed-test-jet@example.com',
      partner_type: 'aviation_broker',
      service_regions: ['NY'],
    },
  ],
  null,
  2,
);

export default function PartnersImport() {
  const [input, setInput] = useState(SAMPLE);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const parseRows = (): any[] | null => {
    try {
      const j = JSON.parse(input);
      if (!Array.isArray(j)) throw new Error('Expected an array');
      return j;
    } catch (e: any) {
      toast.error(`Parse error: ${e.message}`);
      return null;
    }
  };

  const run = async (dryRun: boolean) => {
    const rows = parseRows();
    if (!rows) return;
    setBusy(true);
    setCommitResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-import-partners', {
        body: { rows, dryRun },
      });
      if (error) throw error;
      if (dryRun) setDryRunResult(data);
      else setCommitResult(data);
      toast.success(dryRun ? 'Dry-run complete' : 'Import committed');
    } catch (e: any) {
      toast.error(e.message ?? 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk Import Partners</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a JSON array of partner rows (each with optional nested vehicles). Dry-run first to
          see validation results, then commit. Idempotent: matches existing partners by phone or email.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <label className="text-sm font-medium">Partner rows (JSON)</label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="font-mono text-xs h-72"
        />
        <div className="flex gap-2">
          <Button onClick={() => run(true)} disabled={busy} variant="outline">
            Dry-run
          </Button>
          <Button
            onClick={() => run(false)}
            disabled={busy || !dryRunResult || dryRunResult?.rejected > 0}
          >
            Commit ({dryRunResult ? `${dryRunResult.would_insert + dryRunResult.would_update} ready` : 'run dry-run first'})
          </Button>
        </div>
      </Card>

      {dryRunResult && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Dry-run results</h2>
          <div className="flex gap-3 text-sm">
            <Badge variant="secondary">Insert: {dryRunResult.would_insert}</Badge>
            <Badge variant="secondary">Update: {dryRunResult.would_update}</Badge>
            <Badge variant={dryRunResult.rejected > 0 ? 'destructive' : 'secondary'}>
              Rejected: {dryRunResult.rejected}
            </Badge>
          </div>
          {dryRunResult.rejects?.length > 0 && (
            <div className="text-sm">
              <div className="font-medium mb-1">Rejects:</div>
              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(dryRunResult.rejects, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      )}

      {commitResult && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Commit result</h2>
          <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(commitResult, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
