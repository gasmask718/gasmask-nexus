/**
 * Bulk Jobs Panel — list active and past bulk jobs with live progress.
 */
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useBulkJobs, useBulkJobItems, useCancelBulkJob, useRetryFailedItems, BulkJob } from '@/hooks/useBulkOutreach';
import { MessageSquare, Bot, X, RotateCw, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  processing: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 animate-pulse',
  paused: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  complete: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
};

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ambassadorId: string | null;
}

export function BulkJobsPanel({ open, onOpenChange, ambassadorId }: Props) {
  const { data: jobs = [] } = useBulkJobs(ambassadorId);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const cancel = useCancelBulkJob();
  const retry = useRetryFailedItems();
  const detailJob = jobs.find((j) => j.id === detailJobId);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>Bulk Jobs</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No bulk jobs yet</p>
            ) : (
              jobs.map((j) => {
                const pct = j.total_count > 0 ? Math.round((j.sent_count / j.total_count) * 100) : 0;
                const Icon = j.job_type === 'sms_blast' ? MessageSquare : Bot;
                return (
                  <Card key={j.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {j.job_type === 'sms_blast' ? 'SMS Blast' : 'AI Call Blast'}
                        </span>
                        <Badge className={STATUS_COLORS[j.status]}>{j.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {j.sent_count}/{j.total_count} ·
                        <span className="text-emerald-600 ml-1">✓{j.success_count}</span>
                        <span className="text-amber-600 ml-1">⏭{j.skipped_count}</span>
                        <span className="text-red-600 ml-1">✗{j.failed_count}</span>
                      </span>
                      <div className="flex gap-1">
                        {(j.status === 'queued' || j.status === 'processing' || j.status === 'paused') && (
                          <Button size="sm" variant="ghost" onClick={() => cancel.mutate(j.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                        {j.status === 'complete' && j.failed_count > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => retry.mutate(j)}>
                            <RotateCw className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDetailJobId(j.id)}>
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
      <JobDetailDrawer job={detailJob || null} onClose={() => setDetailJobId(null)} />
    </>
  );
}

function JobDetailDrawer({ job, onClose }: { job: BulkJob | null; onClose: () => void }) {
  const { data: items = [] } = useBulkJobItems(job?.id || null);
  const [filter, setFilter] = useState<string>('all');
  const shown = items.filter((i) => filter === 'all' || i.status === filter);

  const exportCsv = () => {
    if (!items.length) return;
    const rows = [['store_id', 'status', 'skip_reason', 'error', 'processed_at']];
    items.forEach((i) => rows.push([i.store_id, i.status, i.skip_reason || '', i.error_message || '', i.processed_at || '']));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bulk-job-${job!.id.slice(0, 8)}.csv`;
    a.click();
  };

  return (
    <Sheet open={!!job} onOpenChange={(b) => !b && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {job && (
          <>
            <SheetHeader>
              <SheetTitle>Job Detail</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Type: <span className="font-medium">{job.job_type}</span></div>
                <div>Status: <Badge className={STATUS_COLORS[job.status]}>{job.status}</Badge></div>
                <div>Total: {job.total_count}</div>
                <div>Sent: {job.sent_count}</div>
                <div>Success: {job.success_count}</div>
                <div>Failed: {job.failed_count}</div>
                <div>Skipped: {job.skipped_count}</div>
                <div>Pacing: {job.pacing_seconds}s</div>
              </div>
              <div className="flex items-center gap-2">
                {['all', 'sent', 'skipped', 'failed', 'pending'].map((f) => (
                  <Badge key={f} variant={filter === f ? 'default' : 'outline'} className="cursor-pointer capitalize" onClick={() => setFilter(f)}>
                    {f}
                  </Badge>
                ))}
                <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>Export CSV</Button>
              </div>
              <ScrollArea className="h-[50vh] border rounded">
                <div className="divide-y">
                  {shown.map((i) => (
                    <div key={i.id} className="p-2 text-xs flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono truncate">{i.store_id}</div>
                        {i.skip_reason && <div className="text-amber-600">Skip: {i.skip_reason}</div>}
                        {i.error_message && <div className="text-red-600 truncate">{i.error_message}</div>}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{i.status}</Badge>
                    </div>
                  ))}
                  {shown.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No items</div>}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
