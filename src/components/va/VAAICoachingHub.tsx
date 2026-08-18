import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Brain, Search, Loader2, Target, Lightbulb, TrendingUp, FileText, Eye, ChevronLeft, ChevronRight, CheckCircle2, Phone, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { VACoachingInbox } from './VACoachingInbox';
import { RecordingPlayer } from "@/components/phone/RecordingPlayer";

interface CallRow {
  id: string;
  called_at: string;
  duration_seconds: number | null;
  disposition: string | null;
  excitement_level: string | null;
  call_summary: string | null;
  va_notes: string | null;
  transcript: string | null;
  recording_url: string | null;
  recording_sid: string | null;
  ai_analysis: any;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const recordingProxyUrl = (row: CallRow): string | null => {
  if (row.recording_sid) return `${SUPABASE_URL}/functions/v1/play-twilio-recording?sid=${encodeURIComponent(row.recording_sid)}&fmt=mp3`;
  if (row.recording_url) return `${SUPABASE_URL}/functions/v1/play-twilio-recording?url=${encodeURIComponent(row.recording_url)}`;
  return null;
};

const fmtDur = (s: number | null) => {
  if (!s) return '—';
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};

const dispoColor: Record<string, string> = {
  closed: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  callback: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
  voicemail: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  no_answer: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
  not_interested: 'bg-red-500/15 text-red-600 border-red-500/30',
  dnc: 'bg-red-700/20 text-red-700 border-red-700/40',
};

export function VAAICoachingHub() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dispo, setDispo] = useState<string>('all');
  const [mood, setMood] = useState<string>('all');
  const [aiFilter, setAiFilter] = useState<string>('all');
  const [selected, setSelected] = useState<CallRow | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showFeedbackOnOpen, setShowFeedbackOnOpen] = useState(false);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['va-call-summaries', user?.id],
    queryFn: async (): Promise<CallRow[]> => {
      const { data, error } = await supabase
        .from('va_call_logs' as any)
        .select('id, called_at, duration_seconds, disposition, excitement_level, call_summary, va_notes, transcript, recording_url, recording_sid, ai_analysis')
        .eq('va_id', user!.id)
        .order('called_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!user,
  });

  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const analyzeOneMutation = useMutation({
    mutationFn: async (callId: string) => {
      setAnalyzingId(callId);
      const { data, error } = await supabase.functions.invoke('va-analyze-single-call', {
        body: { call_log_id: callId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { analysis: any; source: string };
    },
    onSuccess: (data, callId) => {
      qc.invalidateQueries({ queryKey: ['va-call-summaries', user?.id] });
      const updated = calls.find((c) => c.id === callId);
      if (updated) setSelected({ ...updated, ai_analysis: data.analysis });
      toast.success(`Analysis complete (source: ${data.source})`);
    },
    onError: (e: any) => toast.error(e.message || 'Analysis failed'),
    onSettled: () => setAnalyzingId(null),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter((c) => {
      if (dispo !== 'all' && c.disposition !== dispo) return false;
      if (mood !== 'all' && c.excitement_level !== mood) return false;
      if (aiFilter === 'with' && !c.ai_analysis) return false;
      if (aiFilter === 'without' && c.ai_analysis) return false;
      if (q) {
        const hay = `${c.call_summary || ''} ${c.va_notes || ''} ${c.disposition || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calls, search, dispo, mood, aiFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  );

  const stats = useMemo(() => {
    const total = calls.length;
    const analyzed = calls.filter((c) => c.ai_analysis).length;
    const avgScore = (() => {
      const scores = calls
        .map((c) => c.ai_analysis?.score)
        .filter((s): s is number => typeof s === 'number');
      if (!scores.length) return null;
      return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    })();
    const closed = calls.filter((c) => c.disposition === 'closed').length;
    return { total, analyzed, avgScore, closed };
  }, [calls]);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('va-next-call-coach', {
        body: { limit: 25 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      setAnalysisOpen(true);
      qc.invalidateQueries({ queryKey: ['va-coaching-inbox'] });
      toast.success('AI analysis complete');
    },
    onError: (e: any) => toast.error(e.message || 'Analysis failed'),
  });

  return (
    <div className="space-y-6">
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-cyan-500/5">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" /> AI Coaching
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              All call summaries with filtering, plus on-demand AI analysis to improve your next calls.
            </p>
          </div>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending || calls.length === 0}
            className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
          >
            {analyzeMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</>
            ) : (
              <><Brain className="h-4 w-4 mr-2" /> AI Analysis (Claude)</>
            )}
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" /> Total calls</div>
            <div className="text-2xl font-semibold mt-1">{stats.total}</div>
          </div>
          <div className="rounded-md border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Brain className="h-3.5 w-3.5" /> AI analyzed</div>
            <div className="text-2xl font-semibold mt-1">{stats.analyzed}</div>
          </div>
          <div className="rounded-md border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Avg score</div>
            <div className="text-2xl font-semibold mt-1">{stats.avgScore != null ? `${stats.avgScore}/100` : '—'}</div>
          </div>
          <div className="rounded-md border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Closed</div>
            <div className="text-2xl font-semibold mt-1">{stats.closed}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Call Summaries
            <Badge variant="outline" className="ml-1">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="relative md:col-span-5">
              <Search className="h-4 w-4 absolute left-2.5 top-3 text-muted-foreground" />
              <Input
                placeholder="Search summary or notes…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8"
              />
            </div>
            <Select value={dispo} onValueChange={(v) => { setDispo(v); setPage(1); }}>
              <SelectTrigger className="md:col-span-3"><SelectValue placeholder="Disposition" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dispositions</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="callback">Callback</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
                <SelectItem value="no_answer">No answer</SelectItem>
                <SelectItem value="not_interested">Not interested</SelectItem>
                <SelectItem value="dnc">DNC</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mood} onValueChange={(v) => { setMood(v); setPage(1); }}>
              <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Mood" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All moods</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={aiFilter} onValueChange={(v) => { setAiFilter(v); setPage(1); }}>
              <SelectTrigger className="md:col-span-2"><SelectValue placeholder="AI feedback" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All calls</SelectItem>
                <SelectItem value="with">With AI feedback</SelectItem>
                <SelectItem value="without">Needs analysis</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">When</TableHead>
                  <TableHead className="w-[80px]">Duration</TableHead>
                  <TableHead className="w-[120px]">Disposition</TableHead>
                  <TableHead className="w-[80px]">Mood</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="w-[110px]">AI Feedback</TableHead>
                  <TableHead className="w-[200px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7}><Skeleton className="h-20 w-full" /></TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                      No calls match your filters yet.
                    </TableCell>
                  </TableRow>
                )}
                {pageItems.map((c) => {
                  const hasAi = !!c.ai_analysis;
                  const score = c.ai_analysis?.score;
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setShowFeedbackOnOpen(false); setSelected(c); }}
                    >
                      <TableCell className="text-xs">
                        {formatDistanceToNow(new Date(c.called_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{fmtDur(c.duration_seconds)}</TableCell>
                      <TableCell>
                        {c.disposition ? (
                          <Badge variant="outline" className={dispoColor[c.disposition] || ''}>
                            {c.disposition}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {c.excitement_level ? (
                          <Badge variant="outline" className="capitalize text-[10px]">{c.excitement_level}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs max-w-md truncate">
                        {c.call_summary || c.va_notes || <span className="italic text-muted-foreground">No summary</span>}
                      </TableCell>
                      <TableCell>
                        {hasAi ? (
                          <Badge className="bg-purple-500/15 text-purple-600 border border-purple-500/30 text-[10px]">
                            {typeof score === 'number' ? `Score ${score}` : 'Ready'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">None</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          {hasAi && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setShowFeedbackOnOpen(true); setSelected(c); }}
                              className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700"
                            >
                              <Eye className="h-3 w-3 mr-1" /> Feedback
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={analyzingId === c.id}
                            onClick={() => analyzeOneMutation.mutate(c.id)}
                            className="h-7 px-2 text-xs"
                          >
                            {analyzingId === c.id ? (
                              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyzing</>
                            ) : hasAi ? (
                              <><Brain className="h-3 w-3 mr-1" /> Re-run</>
                            ) : (
                              <><Brain className="h-3 w-3 mr-1" /> Analyze</>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Showing {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="h-7 w-[80px] ml-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  Page {currentPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <VACoachingInbox />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Call Detail</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{new Date(selected.called_at).toLocaleString()}</Badge>
                <Badge variant="outline">Duration: {fmtDur(selected.duration_seconds)}</Badge>
                {selected.disposition && (
                  <Badge variant="outline" className={dispoColor[selected.disposition] || ''}>
                    {selected.disposition}
                  </Badge>
                )}
                {selected.excitement_level && (
                  <Badge variant="outline" className="capitalize">{selected.excitement_level}</Badge>
                )}
              </div>

              {recordingProxyUrl(selected) && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">Recording</p>
                  <RecordingPlayer recordingUrl={selected.recording_url} recordingSid={selected.recording_sid} />
                </div>
              )}

              {selected.call_summary && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">Summary</p>
                  <p className="whitespace-pre-wrap">{selected.call_summary}</p>
                </div>
              )}
              {selected.va_notes && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">VA Notes</p>
                  <p className="whitespace-pre-wrap">{selected.va_notes}</p>
                </div>
              )}
              {selected.transcript && (
                <details>
                  <summary className="text-xs uppercase text-muted-foreground cursor-pointer">Transcript</summary>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {selected.transcript}
                  </pre>
                </details>
              )}

              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={analyzingId === selected.id}
                  onClick={() => analyzeOneMutation.mutate(selected.id)}
                  className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white"
                >
                  {analyzingId === selected.id ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyzing…</>
                  ) : (
                    <><Brain className="h-3 w-3 mr-1" /> {selected.ai_analysis ? 'Re-analyze with Claude' : 'Analyze this call'}</>
                  )}
                </Button>
              </div>

              {selected.ai_analysis && (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-xs uppercase text-muted-foreground">AI Analysis</p>
                  {selected.ai_analysis.summary && (
                    <p className="text-sm">{selected.ai_analysis.summary}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {selected.ai_analysis.score != null && (
                      <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30">
                        Score {selected.ai_analysis.score}/100
                      </Badge>
                    )}
                    {selected.ai_analysis.sentiment && <Badge variant="outline">Sentiment: {selected.ai_analysis.sentiment}</Badge>}
                    {selected.ai_analysis.buyer_intent && <Badge variant="outline">Intent: {selected.ai_analysis.buyer_intent}</Badge>}
                    {selected.ai_analysis.source && <Badge variant="outline">Source: {selected.ai_analysis.source}</Badge>}
                  </div>
                  {selected.ai_analysis.what_went_well?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-emerald-600 mb-1">What went well</p>
                      <ul className="space-y-1">
                        {selected.ai_analysis.what_went_well.map((s: string, i: number) => (
                          <li key={i} className="text-xs flex gap-2"><span>✓</span><span>{s}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selected.ai_analysis.what_to_improve?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-amber-600 mb-1">What to improve</p>
                      <ul className="space-y-1">
                        {selected.ai_analysis.what_to_improve.map((s: string, i: number) => (
                          <li key={i} className="text-xs flex gap-2"><span>→</span><span>{s}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selected.ai_analysis.objections?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 mb-1">Objections</p>
                      <ul className="space-y-1">
                        {selected.ai_analysis.objections.map((s: string, i: number) => (
                          <li key={i} className="text-xs flex gap-2"><span>!</span><span>{s}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selected.ai_analysis.next_best_action && (
                    <div>
                      <p className="text-xs font-medium text-cyan-600 mb-1">Next best action</p>
                      <p className="text-xs italic">{selected.ai_analysis.next_best_action}</p>
                    </div>
                  )}
                  {selected.ai_analysis.recommended_script && (
                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded p-2">
                      <p className="text-xs font-medium text-cyan-700 mb-1">Recommended script</p>
                      <p className="text-xs italic">"{selected.ai_analysis.recommended_script}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" /> AI Coaching Analysis
            </DialogTitle>
          </DialogHeader>
          {analysis && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Based on {analysis.calls_analyzed} recent calls
                </p>
                {typeof analysis.overall_score === 'number' && (
                  <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30">
                    Score {analysis.overall_score}/100
                  </Badge>
                )}
              </div>
              {analysis.summary && (
                <div className="bg-muted/50 rounded-md p-3">
                  <p>{analysis.summary}</p>
                </div>
              )}
              {analysis.patterns?.length > 0 && (
                <section>
                  <h4 className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Patterns Detected
                  </h4>
                  <ul className="space-y-1">
                    {analysis.patterns.map((p: string, i: number) => (
                      <li key={i} className="flex gap-2"><span>•</span><span>{p}</span></li>
                    ))}
                  </ul>
                </section>
              )}
              {analysis.recommendations?.length > 0 && (
                <section>
                  <h4 className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1">
                    <Target className="h-3 w-3" /> Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((r: any, i: number) => (
                      <li key={i} className="border-l-2 border-purple-500/40 pl-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.title}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{r.priority}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.action}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {analysis.scripts?.length > 0 && (
                <section>
                  <h4 className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Scripts to Try
                  </h4>
                  <ul className="space-y-2">
                    {analysis.scripts.map((s: string, i: number) => (
                      <li key={i} className="bg-cyan-500/5 border border-cyan-500/20 rounded p-2 italic">
                        "{s}"
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
