import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type StagingKind = 'stores' | 'invoices' | 'contacts' | 'notes';
const TABLES: Record<StagingKind, string> = {
  stores: 'import_stores_staging',
  invoices: 'import_invoices_staging',
  contacts: 'import_contacts_staging',
  notes: 'import_notes_staging',
};

export default function HistoricalImportReview() {
  const [batchId, setBatchId] = useState('');
  const [activeBatch, setActiveBatch] = useState('');
  const qc = useQueryClient();

  const counts = useQuery({
    queryKey: ['hist-import-counts', activeBatch],
    enabled: !!activeBatch,
    queryFn: async () => {
      const out: Record<string, Record<string, number>> = {};
      for (const [k, t] of Object.entries(TABLES)) {
        const { data, error } = await supabase
          .from(t as any)
          .select('match_status')
          .eq('import_batch_id', activeBatch);
        if (error) throw error;
        const buckets: Record<string, number> = {};
        (data ?? []).forEach((r: any) => {
          buckets[r.match_status] = (buckets[r.match_status] ?? 0) + 1;
        });
        out[k] = buckets;
      }
      return out;
    },
  });

  const runMatch = useMutation({
    mutationFn: async (kind: StagingKind) => {
      const rpc =
        kind === 'stores' ? 'match_import_stores' :
        kind === 'invoices' ? 'match_import_invoices' :
        kind === 'contacts' ? 'match_import_contacts' : null;
      if (!rpc) throw new Error('no match rpc for notes');
      const { data, error } = await supabase.rpc(rpc as any, { _batch_id: activeBatch });
      if (error) throw error;
      // write match_status + matched_id + candidate_ids back to staging
      for (const row of data as any[]) {
        const update: any = {
          match_status: row.match_status,
          matched_id: row.matched_id ?? null,
        };
        if ('candidate_ids' in row) update.candidate_ids = row.candidate_ids;
        if ('composite_hash' in row) update.composite_hash = row.composite_hash;
        await supabase.from(TABLES[kind] as any).update(update).eq('id', row.stage_id);
      }
      return data?.length ?? 0;
    },
    onSuccess: (n, kind) => {
      toast.success(`Matched ${n} ${kind} (dry-run, nothing committed)`);
      qc.invalidateQueries({ queryKey: ['hist-import-counts'] });
      qc.invalidateQueries({ queryKey: ['hist-import-rows'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const commit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('commit_import_batch' as any, {
        _batch_id: activeBatch,
        _committed_by: null,
      });
      if (error) throw error;
      return data as any[];
    },
    onSuccess: (rows) => {
      const ok = rows.filter((r) => r.status === 'ok').length;
      const fail = rows.filter((r) => r.status === 'fail').length;
      toast.success(`Committed ${ok} rows; ${fail} failed.`);
      qc.invalidateQueries({ queryKey: ['hist-import-counts'] });
      qc.invalidateQueries({ queryKey: ['hist-import-rows'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historical Import — Review &amp; Commit</h1>
        <p className="text-sm text-muted-foreground">
          Stage David's old data into <code>import_*_staging</code>, run dry-run matchers, resolve
          ambiguous rows, then commit (batches ≤ 100, <code>is_historical=true</code>,{' '}
          <code>business_date</code> preserved).
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Batch</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="import_batch_id (uuid)"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          />
          <Button onClick={() => setActiveBatch(batchId.trim())} disabled={!batchId.trim()}>
            Load
          </Button>
        </CardContent>
      </Card>

      {activeBatch && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {(['stores', 'invoices', 'contacts', 'notes'] as StagingKind[]).map((k) => (
              <Card key={k}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base capitalize">{k}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {Object.entries(counts.data?.[k] ?? {}).map(([status, n]) => (
                    <div key={status} className="flex justify-between">
                      <Badge variant="outline">{status}</Badge>
                      <span className="font-mono">{n}</span>
                    </div>
                  ))}
                  {k !== 'notes' && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => runMatch.mutate(k)}
                      disabled={runMatch.isPending}
                    >
                      {runMatch.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      Run match (dry-run)
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="stores">
            <TabsList>
              <TabsTrigger value="stores">Stores</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            {(['stores', 'invoices', 'contacts', 'notes'] as StagingKind[]).map((k) => (
              <TabsContent key={k} value={k}>
                <StagingTable kind={k} batchId={activeBatch} />
              </TabsContent>
            ))}
          </Tabs>

          <Card>
            <CardHeader><CardTitle>Commit batch</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Inserts up to 100 rows per call. Skipped &amp; ambiguous-unresolved rows are left
                alone. Re-run until empty. Inserts logged to{' '}
                <code>historical_invoice_repairs</code> for reversibility.
              </p>
              <Button onClick={() => commit.mutate()} disabled={commit.isPending}>
                {commit.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Commit next 100
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StagingTable({ kind, batchId }: { kind: StagingKind; batchId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['hist-import-rows', kind, batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLES[kind] as any)
        .select('*')
        .eq('import_batch_id', batchId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id, decision, matched_id,
    }: { id: string; decision: string; matched_id?: string | null }) => {
      const { error } = await supabase
        .from(TABLES[kind] as any)
        .update({
          reviewer_decision: decision,
          reviewer_decision_at: new Date().toISOString(),
          ...(matched_id !== undefined ? { matched_id } : {}),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hist-import-rows'] });
      qc.invalidateQueries({ queryKey: ['hist-import-counts'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-4"><Loader2 className="animate-spin" /></div>;
  if (!data?.length) return <div className="p-4 text-muted-foreground">No staged rows.</div>;

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2">Row</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Candidates</th>
            <th className="text-left p-2">Payload</th>
            <th className="text-left p-2">Decision</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-mono">{r.source_row_num ?? '—'}</td>
              <td className="p-2">
                <Badge variant={
                  r.match_status === 'exact' ? 'default' :
                  r.match_status === 'ambiguous' ? 'destructive' :
                  r.match_status === 'committed' ? 'secondary' : 'outline'
                }>{r.match_status}</Badge>
                {r.reviewer_decision && (
                  <Badge variant="outline" className="ml-1">{r.reviewer_decision}</Badge>
                )}
              </td>
              <td className="p-2 font-mono text-xs">
                {(r.candidate_ids ?? []).slice(0, 3).map((id: string) => (
                  <div key={id}>{id.slice(0, 8)}…</div>
                ))}
              </td>
              <td className="p-2 max-w-md">
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r.raw_payload, null, 0).slice(0, 200)}</pre>
              </td>
              <td className="p-2 space-x-1 whitespace-nowrap">
                {(r.candidate_ids ?? []).map((id: string) => (
                  <Button key={id} size="sm" variant="outline"
                    onClick={() => decide.mutate({ id: r.id, decision: 'use_existing', matched_id: id })}>
                    Use {id.slice(0, 6)}
                  </Button>
                ))}
                <Button size="sm" variant="default"
                  onClick={() => decide.mutate({ id: r.id, decision: 'create_new', matched_id: null })}>
                  Create new
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => decide.mutate({ id: r.id, decision: 'skip' })}>
                  Skip
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
