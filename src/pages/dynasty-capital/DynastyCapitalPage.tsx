import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFundingClients, useFundingClient } from '@/hooks/useFundingClient';
import { useCapitalPlan } from '@/hooks/useCapitalPlan';
import { useLenderMatches, useRunLenderMatching } from '@/hooks/useLenderMatches';
import { useFundingPlan } from '@/hooks/useFundingStrategy';
import { useApplicationPackages } from '@/hooks/useApplicationPackage';
import { toast } from 'sonner';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const COMPLETE = ['complete', 'completed', 'done', 'verified'];

function useClientContext(clientId?: string) {
  return useQuery({
    queryKey: ['capital-client-context', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const [checklist, tradelines, jobs] = await Promise.all([
        supabase.from('funding_infrastructure_checklist').select('step_key, status').eq('client_id', clientId!),
        supabase.from('funding_tradeline_accounts').select('id').eq('client_id', clientId!),
        supabase
          .from('automation_jobs')
          .select('id, status, submission_method, created_at, lender_name')
          .order('created_at', { ascending: false })
          .limit(25),
      ]);
      if (checklist.error) throw checklist.error;
      return {
        completedSteps: (checklist.data ?? [])
          .filter((c) => COMPLETE.includes((c.status ?? '').toLowerCase()))
          .map((c) => c.step_key as string),
        tradelineCount: tradelines.error ? 0 : (tradelines.data ?? []).length,
        jobs: jobs.error ? [] : (jobs.data ?? []),
      };
    },
  });
}

const statusTone: Record<string, string> = {
  READY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  BLOCKED: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  NOT_QUALIFIED: 'bg-destructive/15 text-destructive border-destructive/30',
  UNKNOWN: 'bg-muted text-muted-foreground border-border',
};

export default function DynastyCapitalPage() {
  const { data: clients, isLoading: clientsLoading } = useFundingClients();
  const [clientId, setClientId] = useState<string | undefined>();
  const activeId = clientId ?? clients?.[0]?.id;

  const { data: client } = useFundingClient(activeId);
  const { data: capital, isLoading: capitalLoading } = useCapitalPlan(activeId);
  const { data: matches } = useLenderMatches(activeId);
  const { data: ctx } = useClientContext(activeId);
  const runMatching = useRunLenderMatching();
  const { plan, isLoading: planLoading } = useFundingPlan({
    client,
    completedSteps: ctx?.completedSteps,
    tradelineCount: ctx?.tradelineCount,
  });
  const { data: packages, isLoading: packagesLoading } = useApplicationPackages(activeId, client);



  const totals = capital?.totals;
  const grantRows = capital?.grants ?? [];
  const fundingRows = capital?.funding ?? [];

  const kpis = useMemo(
    () => [
      { label: 'Requested', value: money(totals?.requested ?? 0) },
      { label: 'Approved', value: money(totals?.approved ?? 0) },
      { label: 'Capital Secured', value: money(totals?.funded ?? 0) },
      { label: 'Pending', value: money(totals?.pending ?? 0) },
    ],
    [totals],
  );

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dynasty Capital</h1>
        <p className="text-sm text-muted-foreground">
          Unified capital view for every Funding Hub client — loans, credit and grants read from one
          model. No second client database.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Clients</CardTitle>
          <CardDescription>Funding Hub is the source of truth for client identity.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {clientsLoading && <Skeleton className="h-9 w-48" />}
          {!clientsLoading && (clients ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No funding clients yet. Create one at /funding-machine/intake.</p>
          )}
          {(clients ?? []).map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === activeId ? 'default' : 'outline'}
              onClick={() => setClientId(c.id)}
            >
              {c.full_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email || c.id.slice(0, 8)}
            </Button>
          ))}
        </CardContent>
      </Card>

      {activeId && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{k.label}</CardDescription>
                  <CardTitle className="text-2xl">{capitalLoading ? '—' : k.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="funding">
            <TabsList>
              <TabsTrigger value="funding">Funding</TabsTrigger>
              <TabsTrigger value="grants">Grants</TabsTrigger>
              <TabsTrigger value="strategy">Funding Plan</TabsTrigger>
              <TabsTrigger value="lenders">Lender Matches</TabsTrigger>
              <TabsTrigger value="packages">Application Package</TabsTrigger>
              <TabsTrigger value="automation">Automation</TabsTrigger>
            </TabsList>

            <TabsContent value="funding">
              <Card>
                <CardHeader><CardTitle className="text-base">Funding applications</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {fundingRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">No funding applications for this client.</p>
                  )}
                  {fundingRows.map((r) => (
                    <div key={r.reference_id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <div>
                        <p className="font-medium">{r.counterparty || 'Unnamed lender'}</p>
                        <p className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{money(Number(r.amount_requested))}</span>
                        <Badge variant="outline">{(r.status || 'unknown').toUpperCase()}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="grants">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Grant applications</CardTitle>
                  <CardDescription>
                    Grant rows appear here once the grant business profile is linked to this funding client.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {grantRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">No linked grant applications for this client.</p>
                  )}
                  {grantRows.map((r) => (
                    <div key={r.reference_id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <div>
                        <p className="font-medium">{r.counterparty || 'Grant opportunity'}</p>
                        <p className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{money(Number(r.amount_requested))}</span>
                        <Badge variant="outline">{(r.status || 'unknown').toUpperCase()}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="strategy">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Funding plan</CardTitle>
                  <CardDescription>
                    Sequencing comes from funding_strategy_rules. Every step explains why it sits where it does.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {planLoading && <Skeleton className="h-24 w-full" />}
                  {plan.map((s) => (
                    <div key={s.step_key} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          Step {s.step_order} — {s.step_label}
                        </p>
                        <Badge variant="outline" className={statusTone[s.status]}>{s.status}</Badge>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {s.explanations.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lenders">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Lender matches</CardTitle>
                    <CardDescription>Deterministic verdicts with per-rule explanations.</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    disabled={runMatching.isPending}
                    onClick={() =>
                      runMatching.mutate(activeId, {
                        onSuccess: (d) =>
                          toast.success(
                            d?.note ?? `Evaluated ${d?.lender_universe ?? 0} lenders — ${d?.matched_count ?? 0} pursuable`,
                          ),
                        onError: (e: Error) => toast.error(e.message),
                      })
                    }
                  >
                    {runMatching.isPending ? 'Running…' : 'Run matching'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(matches ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No lender matches. The lender database must be populated with verified lender records
                      at /funding-machine/lender-import before matching can return results.
                    </p>
                  )}
                  {(matches ?? []).map((m) => (
                    <div key={m.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {m.lender?.lender_name} — {m.lender?.product_name}
                        </p>
                        <Badge variant="outline">{m.match_score ?? 0}/100</Badge>
                      </div>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        {(m.match_reasons ?? []).map((r, i) => <li key={i}>• {r}</li>)}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="packages">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Application packages</CardTitle>
                  <CardDescription>
                    One package per matched lender, assembled from what is actually on file. Nothing is
                    invented — absent values are listed as missing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {packagesLoading && <Skeleton className="h-24 w-full" />}
                  {!packagesLoading && (packages ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No packages yet. Run lender matching first — a package is built for each persisted match.
                    </p>
                  )}
                  {(packages ?? []).map((pkg) => (
                    <div key={pkg.lender_id} className="rounded-md border p-3 text-sm space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">
                          {pkg.lender_name}
                          {pkg.product_name ? ` — ${pkg.product_name}` : ''}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{pkg.submission_method}</Badge>
                          <Badge variant="outline" className={packageTone[pkg.status]}>
                            {pkg.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-muted-foreground">
                        Client authorization:{' '}
                        {pkg.consent_signed
                          ? `signed${pkg.consent_signed_at ? ` ${new Date(pkg.consent_signed_at).toLocaleDateString()}` : ''}`
                          : 'not on file — submission blocked'}
                      </p>
                      {pkg.missing_fields.length > 0 && (
                        <p className="text-muted-foreground">
                          Missing fields ({pkg.missing_fields.length}): {pkg.missing_fields.join(', ')}
                        </p>
                      )}
                      {pkg.missing_documents.length > 0 && (
                        <p className="text-muted-foreground">
                          Missing documents: {pkg.missing_documents.join(', ')}
                        </p>
                      )}
                      {pkg.notes.map((n, i) => (
                        <p key={i} className="text-muted-foreground">• {n}</p>
                      ))}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {pkg.sections.map((s) => (
                          <div key={s.key} className="rounded border p-2">
                            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                              {s.title}
                            </p>
                            <ul className="mt-1 space-y-0.5">
                              {s.fields.map((f) => (
                                <li key={f.key} className={f.present ? '' : 'text-muted-foreground'}>
                                  {f.label}: {f.present ? String(f.value) : f.required ? 'MISSING (required)' : '—'}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pkg.status !== 'READY'}
                        onClick={() =>
                          toast.info(
                            `Create an automation job for ${pkg.lender_name} at /funding-machine/automation (${pkg.submission_method}).`,
                          )
                        }
                      >
                        {pkg.status === 'READY' ? 'Package ready to submit' : `Cannot submit — ${pkg.status.replace('_', ' ')}`}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="automation">
              <Card>
                <CardHeader><CardTitle className="text-base">Automation jobs</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(ctx?.jobs ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No automation jobs have been created yet.</p>
                  )}
                  {(ctx?.jobs ?? []).map((j: { id: string; status: string | null; submission_method: string | null; lender_name: string | null; created_at: string }) => (
                    <div key={j.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <span>{j.lender_name ?? 'Lender'} · {j.submission_method ?? 'manual'}</span>
                      <Badge variant="outline">{(j.status ?? 'unknown').toUpperCase()}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
