import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Bot, UserCheck, AlertTriangle, CheckCircle2, RotateCcw, Ban, Hand } from 'lucide-react';
import {
  useAutomationJobs, useAutomationJobDetail, useAutomationActions, type AutomationJob,
} from '@/hooks/useAutomationJobs';

const STATUS_TONE: Record<string, string> = {
  COMPLETED: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  HUMAN_CHECKPOINT: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  NEEDS_HUMAN_REVIEW: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  NEEDS_INFORMATION: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  BLOCKED: 'bg-destructive/15 text-destructive border-destructive/30',
  FAILED: 'bg-destructive/15 text-destructive border-destructive/30',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
};

const RUNNING = ['STARTING', 'RUNNING', 'FORM_DETECTED', 'FILLING', 'DOCUMENT_UPLOAD', 'READY_TO_SUBMIT', 'SUBMITTING', 'READING_RESPONSE'];
const WAITING = ['HUMAN_CHECKPOINT', 'NEEDS_HUMAN_REVIEW', 'NEEDS_INFORMATION', 'BLOCKED'];

export default function ApplicationAutomationPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [openJob, setOpenJob] = useState<AutomationJob | null>(null);
  const [newAppId, setNewAppId] = useState('');
  const [method, setMethod] = useState('auto');
  const [note, setNote] = useState('');

  const { data: jobs = [], isLoading } = useAutomationJobs(statusFilter);
  const { data: detail } = useAutomationJobDetail(openJob?.id ?? null);
  const actions = useAutomationActions();

  const { data: applications = [] } = useQuery({
    queryKey: ['funding-applications-for-automation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_applications')
        .select('id, lender_name, product_type, status, requested_amount')
        .order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const counts = {
    running: jobs.filter((j) => RUNNING.includes(j.status)).length,
    waiting: jobs.filter((j) => WAITING.includes(j.status)).length,
    completedToday: jobs.filter((j) => j.status === 'COMPLETED' && j.last_event_at?.startsWith(today)).length,
    failed: jobs.filter((j) => j.status === 'FAILED').length,
    review: jobs.filter((j) => j.status === 'NEEDS_HUMAN_REVIEW').length,
  };

  const pendingCheckpoint = detail?.checkpoints?.find((c: any) => c.status === 'PENDING');

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" /> Application Automation
          </h1>
          <p className="text-sm text-muted-foreground">
            Execution layer for Funding Hub applications. Funding Hub remains the system of record.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={newAppId} onValueChange={setNewAppId}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select a Funding Hub application" /></SelectTrigger>
            <SelectContent>
              {applications.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.lender_name || 'Unnamed lender'} — {a.product_type || 'n/a'} ({a.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="browser">Browser</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Button
            disabled={!newAppId || actions.createJob.isPending}
            onClick={() => actions.createJob.mutate({
              application_id: newAppId,
              ...(method !== 'auto' ? { submission_method: method } : {}),
            })}
          >
            {actions.createJob.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Start Automation
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          { label: 'Running', value: counts.running, icon: Loader2 },
          { label: 'Waiting for Human', value: counts.waiting, icon: UserCheck },
          { label: 'Completed Today', value: counts.completedToday, icon: CheckCircle2 },
          { label: 'Failed', value: counts.failed, icon: AlertTriangle },
          { label: 'Needs Review', value: counts.review, icon: Hand },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
                <s.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Automation Jobs</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {['QUEUED', 'RUNNING', 'HUMAN_CHECKPOINT', 'NEEDS_INFORMATION', 'NEEDS_HUMAN_REVIEW', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'].map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No automation jobs yet. Select a Funding Hub application above to create one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lender</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Human Action</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last Event</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.lender_name ?? '—'}</TableCell>
                    <TableCell className="uppercase text-xs">{j.submission_method}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_TONE[j.status] ?? ''}>
                        {j.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{j.human_action_type?.replace(/_/g, ' ') ?? '—'}</TableCell>
                    <TableCell className="text-xs">{j.attempt_count}/{j.max_attempts}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {j.last_event_at ? new Date(j.last_event_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setOpenJob(j)}>Open</Button>
                      {['FAILED', 'NEEDS_INFORMATION', 'NEEDS_HUMAN_REVIEW'].includes(j.status) && (
                        <Button size="sm" variant="ghost" onClick={() => actions.retryJob.mutate({ job_id: j.id })}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!['COMPLETED', 'CANCELLED'].includes(j.status) && (
                        <Button size="sm" variant="ghost" onClick={() => actions.cancelJob.mutate({ job_id: j.id })}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openJob} onOpenChange={(o) => { if (!o) { setOpenJob(null); setNote(''); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {openJob?.lender_name ?? 'Automation Job'} — {openJob?.status.replace(/_/g, ' ')}
            </DialogTitle>
          </DialogHeader>

          {openJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Application:</span> {openJob.application_id}</div>
                <div><span className="text-muted-foreground">Method:</span> {openJob.submission_method}</div>
                <div><span className="text-muted-foreground">Result:</span> {openJob.result_status ?? '—'}</div>
                <div><span className="text-muted-foreground">Lender ref:</span> {openJob.lender_reference ?? '—'}</div>
              </div>

              {openJob.failure_reason && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <strong>{openJob.failure_class ?? 'Issue'}:</strong> {openJob.failure_reason}
                </div>
              )}

              {openJob.missing_fields?.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  <strong>Missing / invalid fields:</strong> {openJob.missing_fields.join(', ')}
                </div>
              )}

              {pendingCheckpoint && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <p className="text-sm font-medium">
                    Human checkpoint: {String(pendingCheckpoint.checkpoint_type).replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">{pendingCheckpoint.reason}</p>
                  <Textarea
                    placeholder="Confirmation note — describe the action you personally completed"
                    value={note} onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!note.trim()} onClick={() => actions.resolveCheckpoint.mutate({
                      checkpoint_id: pendingCheckpoint.id, note, resume: true,
                    })}>
                      I completed this — resume
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => actions.resolveCheckpoint.mutate({
                      checkpoint_id: pendingCheckpoint.id, note: note || 'Abandoned', abandoned: true,
                    })}>
                      Abandon job
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => actions.switchToManual.mutate({ job_id: openJob.id })}>
                      Switch to manual
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium mb-2">Isolated sessions</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  One throwaway browser session per job, per client. No shared state, no reuse.
                </p>
                <div className="space-y-1">
                  {(detail?.sessions ?? []).map((s: any) => (
                    <div key={s.id} className="text-xs flex flex-wrap gap-3 border-b border-border/50 py-1">
                      <Badge variant="outline" className={STATUS_TONE[s.status] ?? ''}>{s.status}</Badge>
                      <span className="text-muted-foreground">{new Date(s.started_at).toLocaleString()}</span>
                      <span className="font-mono">{s.provider}</span>
                      <span className="text-muted-foreground">{s.infrastructure_region}</span>
                      <span className="text-muted-foreground">owner: {s.session_owner}</span>
                      {s.is_qa_fixture && <Badge variant="outline">QA fixture</Badge>}
                      {s.error_code && <span className="text-destructive">{s.error_code}</span>}
                    </div>
                  ))}
                  {(detail?.sessions ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No session has been opened for this job.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Audit trail</h3>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {(detail?.events ?? []).map((e: any) => (
                    <div key={e.id} className="text-xs flex gap-3 border-b border-border/50 py-1">
                      <span className="text-muted-foreground whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                      <span className="font-mono">{e.event_type}</span>
                      <span className="text-muted-foreground truncate">{e.message}</span>
                    </div>
                  ))}
                  {(detail?.events ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No events recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
