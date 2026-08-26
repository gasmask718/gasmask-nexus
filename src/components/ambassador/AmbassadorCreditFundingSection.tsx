import { Landmark, CheckCircle2, Circle, Clock, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useMyFundingClient, useExpressFundingInterest } from '@/hooks/useAmbassadorFunding';

interface Props {
  ambassadorId?: string | null;
  interestExpressed?: boolean | null;
}

const STAGE_LABEL: Record<string, string> = {
  intake: 'Intake',
  credit_repair: 'Credit Repair',
  credit_ready: 'Credit Ready',
  funding_active: 'Funding Active',
  funded: 'Funded',
  grant_eligible: 'Grant Eligible',
  complete: 'Complete',
};

export default function AmbassadorCreditFundingSection({ ambassadorId, interestExpressed }: Props) {
  const { data, isLoading, error } = useMyFundingClient();
  const express = useExpressFundingInterest();

  const client = data?.client;
  const checklist = data?.checklist ?? [];
  const done = checklist.filter((s) => s.status === 'complete' || s.status === 'completed').length;
  const pct = checklist.length ? Math.round((done / checklist.length) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          Credit &amp; Funding
        </CardTitle>
        <CardDescription>
          A dedicated financial services team, separate from your ambassador work, that builds your
          credit profile and walks you toward funding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/15 p-3 text-sm">
            {(error as Error).message}
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading your funding status…</p>}

        {!isLoading && !client && (
          <div className="space-y-3">
            {interestExpressed ? (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-primary" />
                <span>
                  Your interest is recorded. A funding advisor reviews every request manually — you'll
                  get an email and a text when you're approved to start.
                </span>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Interested in building business credit and accessing funding? Raise your hand and an
                  advisor will review your file.
                </p>
                <Button
                  disabled={!ambassadorId || express.isPending}
                  onClick={() => {
                    if (!ambassadorId) return;
                    express.mutate(ambassadorId, {
                      onSuccess: () => toast.success("Interest recorded — an advisor will review your file."),
                      onError: (e: unknown) => toast.error((e as Error).message),
                    });
                  }}
                >
                  {express.isPending ? 'Submitting…' : "I'm interested in funding"}
                </Button>
              </>
            )}
          </div>
        )}

        {client && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{STAGE_LABEL[client.stage ?? 'intake'] ?? client.stage}</Badge>
              {client.consent_signed && (
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Consent on file
                </Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Credit score (avg)</p>
                <p className="text-2xl font-semibold">{client.current_dfs_score || '—'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Funding ceiling</p>
                <p className="text-2xl font-semibold">
                  ${Number(client.current_funding_ceiling || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Funding received</p>
                <p className="text-2xl font-semibold">
                  ${Number(client.funding_received || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Business infrastructure checklist</span>
                <span className="text-muted-foreground">{done}/{checklist.length} complete</span>
              </div>
              <Progress value={pct} />
              <ul className="mt-2 space-y-1">
                {checklist.map((step) => {
                  const complete = step.status === 'complete' || step.status === 'completed';
                  return (
                    <li key={step.id} className="flex items-center gap-2 text-sm">
                      {complete ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={complete ? '' : 'text-muted-foreground'}>{step.step_label}</span>
                      {step.provider && (
                        <span className="text-xs text-muted-foreground">· {step.provider}</span>
                      )}
                    </li>
                  );
                })}
                {checklist.length === 0 && (
                  <li className="text-sm text-muted-foreground">No checklist steps yet.</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
