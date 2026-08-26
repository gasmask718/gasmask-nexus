import { useState } from 'react';
import { Landmark, Send, RefreshCw, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  useFundingInviteCandidates,
  useRouteAmbassadorToFunding,
  useFundingSmsQueue,
  useProcessFundingSmsQueue,
  type FundingInviteCandidate,
} from '@/hooks/useAmbassadorFunding';

export default function FundingInvitesPage() {
  const { data: candidates = [], isLoading, error, refetch, isFetching } = useFundingInviteCandidates();
  const { data: queue = [], refetch: refetchQueue } = useFundingSmsQueue();
  const route = useRouteAmbassadorToFunding();
  const processQueue = useProcessFundingSmsQueue();
  const [target, setTarget] = useState<FundingInviteCandidate | null>(null);

  const pending = candidates.filter((c) => !c.funding_client_id);
  const routed = candidates.filter((c) => c.funding_client_id);
  const queued = queue.filter((q: any) => q.status === 'queued').length;

  const confirmInvite = () => {
    if (!target) return;
    route.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.name ?? 'Ambassador'} routed into the Funding Hub — invite email and text queued.`);
        setTarget(null);
      },
      onError: (e: unknown) => toast.error((e as Error).message),
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Funding Invites
          </h1>
          <p className="text-sm text-muted-foreground">
            Ambassadors who raised their hand for the credit &amp; funding program. Invites are staff-triggered
            and manual — nothing is sent automatically.
          </p>
        </div>
        <Button variant="outline" onClick={() => { refetch(); refetchQueue(); }} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/15 p-3 text-sm">
          {(error as Error).message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Awaiting invite ({pending.length})</CardTitle>
          <CardDescription>Each invite creates a funding client, the infrastructure checklist, and queues the welcome email + text.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ambassador</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Interest date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!isLoading && pending.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">No pending funding requests.</TableCell></TableRow>
              )}
              {pending.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    <div>{c.email ?? '—'}</div>
                    <div className="text-muted-foreground">{c.phone_primary ?? 'no phone'}</div>
                  </TableCell>
                  <TableCell className="text-sm">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</TableCell>
                  <TableCell className="text-sm">
                    {c.funding_interest_expressed_at
                      ? new Date(c.funding_interest_expressed_at).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setTarget(c)} disabled={route.isPending}>
                      <Send className="h-4 w-4 mr-2" />
                      Send funding invite
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routed into funding ({routed.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ambassador</TableHead>
                <TableHead>Qualified</TableHead>
                <TableHead>Funding client</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routed.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">None yet.</TableCell></TableRow>
              )}
              {routed.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {c.funding_qualified_at ? new Date(c.funding_qualified_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <a className="text-primary underline text-sm" href={`/funding-machine/client/${c.funding_client_id}`}>
                      Open profile
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Funding text queue
            </CardTitle>
            <CardDescription>{queued} queued · sent through the standard transactional SMS path with idempotency.</CardDescription>
          </div>
          <Button
            variant="outline"
            disabled={processQueue.isPending}
            onClick={() =>
              processQueue.mutate(undefined, {
                onSuccess: (r) => toast.success(`Processed ${r.claimed}: ${r.sent} sent, ${r.blocked} suppressed, ${r.failed} failed`),
                onError: (e: unknown) => toast.error((e as Error).message),
              })
            }
          >
            {processQueue.isPending ? 'Processing…' : 'Process queue now'}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Queued</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Queue is empty.</TableCell></TableRow>
              )}
              {queue.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Badge variant={q.status === 'sent' ? 'default' : q.status === 'queued' ? 'secondary' : 'destructive'}>
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{q.phone_number}</TableCell>
                  <TableCell className="text-sm">{q.related_kind}</TableCell>
                  <TableCell className="text-sm">{new Date(q.queued_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">{q.error ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send funding invite to {target?.name ?? 'this ambassador'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates their funding client record and infrastructure checklist, and queues a welcome
              email{target?.phone_primary ? ' and text message' : ''}. This action cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={route.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmInvite} disabled={route.isPending}>
              {route.isPending ? 'Sending…' : 'Confirm invite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
