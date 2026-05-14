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
import { Sparkles, Brain, Search, Loader2, Target, Lightbulb, TrendingUp, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { VACoachingInbox } from './VACoachingInbox';

interface CallRow {
  id: string;
  called_at: string;
  duration_seconds: number | null;
  disposition: string | null;
  excitement_level: string | null;
  call_summary: string | null;
  va_notes: string | null;
  ai_analysis: any;
}

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
  const [selected, setSelected] = useState<CallRow | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['va-call-summaries', user?.id],
    queryFn: async (): Promise<CallRow[]> => {
      const { data, error } = await supabase
        .from('va_call_logs' as any)
        .select('id, called_at, duration_seconds, disposition, excitement_level, call_summary, va_notes, ai_analysis')
        .eq('va_id', user!.id)
        .order('called_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter((c) => {
      if (dispo !== 'all' && c.disposition !== dispo) return false;
      if (mood !== 'all' && c.excitement_level !== mood) return false;
      if (q) {
        const hay = `${c.call_summary || ''} ${c.va_notes || ''} ${c.disposition || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calls, search, dispo, mood]);

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
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Call Summaries ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-2.5 top-3 text-muted-foreground" />
              <Input
                placeholder="Search summary or notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={dispo} onValueChange={setDispo}>
              <SelectTrigger className="md:w-44"><SelectValue placeholder="Disposition" /></SelectTrigger>
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
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger className="md:w-36"><SelectValue placeholder="Mood" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All moods</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">When</TableHead>
                  <TableHead className="w-[80px]">Duration</TableHead>
                  <TableHead className="w-[130px]">Disposition</TableHead>
                  <TableHead className="w-[90px]">Mood</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={5}><Skeleton className="h-20 w-full" /></TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                      No calls match your filters yet.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(c)}
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
                        <Badge variant="outline" className="capitalize">{c.excitement_level}</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-md truncate">
                      {c.call_summary || c.va_notes || <span className="italic text-muted-foreground">No summary</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <VACoachingInbox />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Call Summary</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
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
              {selected.ai_analysis && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">AI Analysis</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(selected.ai_analysis, null, 2)}
                  </pre>
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
