import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Search, Check, AlertTriangle, Loader2, FileText,
  Server, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DirtyNote {
  id: string;
  store_id: string;
  note_text: string;
  created_at: string;
  store_name?: string;
}

interface JobStatus {
  id: string;
  status: string;
  total_records: number;
  processed_records: number;
  failed_records: number;
  current_record: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

function needsCleaning(note: string | null): boolean {
  if (!note) return false;
  const htmlPattern = /<\/?[a-z][\s\S]*?>/i;
  const entityPattern = /&amp;|&nbsp;|&lt;|&gt;|&#\d+;/i;
  const brokenCharPattern = /â|Â|donâ|canâ|isnâ|wonâ|didnâ/;
  return htmlPattern.test(note) || entityPattern.test(note) || brokenCharPattern.test(note);
}

export default function NoteCleanerPage() {
  const [scanning, setScanning] = useState(false);
  const [dirtyNotes, setDirtyNotes] = useState<DirtyNote[]>([]);
  const [scanned, setScanned] = useState(false);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    checkForRunningJob();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const checkForRunningJob = async () => {
    const { data } = await supabase
      .from('note_cleaner_jobs' as any)
      .select('*')
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1);

    const jobs = data as any[];
    if (jobs?.length) {
      const runningJob = jobs[0] as JobStatus;
      setJob(runningJob);
      setCleaning(true);
      toast.info(`Reconnected — ${runningJob.processed_records}/${runningJob.total_records} cleaned`);
      // Resume batch processing
      resumeBatching(runningJob.id);
    } else {
      const { data: recent } = await supabase
        .from('note_cleaner_jobs' as any)
        .select('*')
        .in('status', ['complete', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1);

      const recentJobs = recent as any[];
      if (recentJobs?.length) {
        const lastJob = recentJobs[0] as JobStatus;
        const completedAt = lastJob.completed_at ? new Date(lastJob.completed_at) : null;
        if (completedAt && Date.now() - completedAt.getTime() < 3600000) {
          setJob(lastJob);
        }
      }
    }
  };

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('note_cleaner_jobs' as any)
        .select('*')
        .eq('id', jobId)
        .single();

      if (data) {
        const j = data as unknown as JobStatus;
        setJob(j);
        if (j.status === 'complete' || j.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 3000);
  };

  const resumeBatching = async (jobId: string) => {
    abortRef.current = false;
    startPolling(jobId);

    let hasMore = true;
    while (hasMore && !abortRef.current) {
      try {
        const { data, error } = await supabase.functions.invoke('run-note-cleaner', {
          body: { batch_size: 10, job_id: jobId },
        });

        if (error) {
          console.error('Batch error:', error);
          break;
        }

        if (!data?.success) {
          if (data?.error) toast.error(data.error);
          break;
        }

        hasMore = data.has_more;

        if (!hasMore || data.status === 'complete') {
          setCleaning(false);
          toast.success(`Complete — ${data.total_processed} notes cleaned`);
          break;
        }

        // Small delay between batches
        await new Promise(r => setTimeout(r, 1500));
      } catch (err: any) {
        console.error('Batch chain error:', err);
        toast.error('Batch processing interrupted — reopen to resume');
        break;
      }
    }

    setCleaning(false);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    // Final refresh
    checkForRunningJob();
  };

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanned(false);
    try {
      const { data, error } = await supabase
        .from('store_notes')
        .select('id, store_id, note_text, created_at, store_master!store_notes_store_id_fkey(store_name)')
        .or('note_text.ilike.%<div>%,note_text.ilike.%<br>%,note_text.ilike.%<p %,note_text.ilike.%<span>%,note_text.ilike.%&amp;%,note_text.ilike.%&nbsp;%,note_text.ilike.%â%')
        .is('cleaning_status', null)
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) throw error;

      const filtered = (data || [])
        .filter((n: any) => needsCleaning(n.note_text))
        .map((n: any) => ({
          id: n.id,
          store_id: n.store_id,
          note_text: n.note_text,
          created_at: n.created_at,
          store_name: (n.store_master as any)?.store_name || 'Unknown Store',
        }));

      setDirtyNotes(filtered);
      setScanned(true);
      toast.success(`Found ${filtered.length} notes needing cleanup`);
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, []);

  const startCleaningJob = useCallback(async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-note-cleaner', {
        body: { batch_size: 10 },
      });

      if (error) throw error;

      if (data?.job_id) {
        const newJob: JobStatus = {
          id: data.job_id,
          status: 'running',
          total_records: data.total_records || 0,
          processed_records: data.total_processed || data.processed_this_batch || 0,
          failed_records: data.failed_this_batch || 0,
          current_record: null,
          error: null,
          started_at: new Date().toISOString(),
          completed_at: null,
        };
        setJob(newJob);
        setCleaning(true);
        toast.success('Cleaning started — processing in batches of 10');

        // Chain remaining batches
        if (data.has_more) {
          resumeBatching(data.job_id);
        } else {
          setCleaning(false);
          toast.success(`Complete — ${data.total_processed} notes cleaned`);
        }
      } else if (data?.message) {
        toast.info(data.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start cleaning job');
    } finally {
      setStarting(false);
    }
  }, []);

  const isRunning = job?.status === 'running' || cleaning;
  const isComplete = job?.status === 'complete' && !cleaning;
  const isFailed = job?.status === 'failed' && !cleaning;
  const progressPct = job && job.total_records > 0
    ? Math.round((job.processed_records / job.total_records) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-lg">Note Cleaner Agent</CardTitle>
                <CardDescription>
                  Scans account notes for legacy HTML formatting and rewrites in proper English — processes in batches of 10
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {scanned && (
                <Badge variant="outline" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  {dirtyNotes.length} notes need cleaning
                </Badge>
              )}
              <Button onClick={runScan} disabled={scanning || isRunning} variant="outline" className="gap-2">
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {scanning ? 'Scanning...' : 'Scan Notes'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isRunning && job && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-500 animate-pulse" />
                <span className="text-sm font-medium">Batch cleaning in progress</span>
              </div>
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-500/30">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Running
              </Badge>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Cleaning: {job.processed_records} of {job.total_records} notes</span>
              <span className="font-medium">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            {job.failed_records > 0 && (
              <p className="text-xs text-destructive">{job.failed_records} failed</p>
            )}
            <p className="text-xs text-muted-foreground">
              Processing in batches of 10 to avoid timeouts. Safe to navigate away — reopen to resume.
            </p>
          </CardContent>
        </Card>
      )}

      {isComplete && job && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Cleaning Complete</p>
                  <p className="text-xs text-muted-foreground">
                    {job.processed_records} cleaned, {job.failed_records} failed
                    {job.completed_at && ` — ${new Date(job.completed_at).toLocaleTimeString()}`}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { setJob(null); runScan(); }}>
                <RefreshCw className="h-3 w-3" />
                Scan Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isFailed && job && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium">Cleaning Failed</p>
                  <p className="text-xs text-muted-foreground">
                    {job.error || 'Unknown error'} — {job.processed_records} of {job.total_records} processed
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setJob(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {scanned && dirtyNotes.length > 0 && !isRunning && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium">
                {dirtyNotes.length} notes with legacy HTML detected
              </span>
            </div>
            <Button onClick={startCleaningJob} disabled={starting} className="gap-2">
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
              {starting ? 'Starting...' : 'Clean All (Batched)'}
            </Button>
          </CardContent>
        </Card>
      )}

      {scanned && dirtyNotes.length > 0 && !isRunning && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Preview — Notes to Clean</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-480px)]">
              <div className="space-y-2 pr-2">
                {dirtyNotes.slice(0, 20).map(note => (
                  <div key={note.id} className="p-3 rounded-md border border-border bg-muted/30 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold">{note.store_name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground line-clamp-2 break-words">
                      {note.note_text.slice(0, 200)}...
                    </p>
                  </div>
                ))}
                {dirtyNotes.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    + {dirtyNotes.length - 20} more notes
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {scanned && dirtyNotes.length === 0 && !isRunning && !isComplete && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-8 text-center">
            <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <p className="font-semibold">All clean!</p>
            <p className="text-sm text-muted-foreground">No legacy HTML notes found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
