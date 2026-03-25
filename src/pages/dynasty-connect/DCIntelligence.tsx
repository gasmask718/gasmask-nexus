import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Phone, Search, X, Clock, Bot,
  ChevronDown, Zap, Loader2, Brain, TrendingUp, BarChart3, Target,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
];

const agentName = (id: string) => AGENTS.find(a => a.id === id)?.name || '—';

const OUTCOME_STYLES: Record<string, string> = {
  booked: 'bg-green-500/10 text-green-500 border-green-500',
  interested: 'bg-teal-500/10 text-teal-500 border-teal-500',
  callback: 'bg-amber-500/10 text-amber-500 border-amber-500',
  callback_requested: 'bg-amber-500/10 text-amber-500 border-amber-500',
  'not-interested': 'bg-red-500/10 text-red-500 border-red-500',
  not_interested: 'bg-red-500/10 text-red-500 border-red-500',
  'wrong-number': 'bg-red-500/10 text-red-500 border-red-500',
  voicemail: 'border-muted-foreground text-muted-foreground',
  'no-decision': 'bg-muted text-muted-foreground',
};
const outcomeStyle = (o: string) => OUTCOME_STYLES[o] || 'bg-muted text-muted-foreground';

const OUTCOME_COLORS: Record<string, string> = {
  booked: '#22c55e', interested: '#14b8a6', callback: '#f59e0b',
  'not-interested': '#ef4444', voicemail: '#6b7280', 'no-decision': '#9ca3af',
  'wrong-number': '#dc2626',
};

const isWin = (o: string) => ['booked', 'interested'].includes(o);
const fmtDur = (s: number | null) => s ? `${Math.floor(s / 60)}m ${s % 60}s` : '—';

function parseTranscriptLines(text: string) {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (/^AI:/i.test(trimmed)) return { id: i, speaker: 'ai', text: trimmed.replace(/^AI:\s*/i, '') };
    if (/^CALLER:/i.test(trimmed)) return { id: i, speaker: 'caller', text: trimmed.replace(/^CALLER:\s*/i, '') };
    if (/^Agent:/i.test(trimmed)) return { id: i, speaker: 'ai', text: trimmed.replace(/^Agent:\s*/i, '') };
    if (/^User:/i.test(trimmed)) return { id: i, speaker: 'caller', text: trimmed.replace(/^User:\s*/i, '') };
    return { id: i, speaker: 'system', text: trimmed };
  });
}

export default function DCIntelligence() {
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  // ── Call Logs ──
  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ['dc-call-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('id, call_sid, phone_number, outcome, duration_seconds, full_transcript, ai_summary, persona_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // ── Structured transcripts from live_call_transcripts ──
  const { data: transcripts = [] } = useQuery({
    queryKey: ['dc-call-transcripts', selectedCall?.id],
    queryFn: async () => {
      if (!selectedCall) return [];
      const callSid = selectedCall.call_sid;
      if (!callSid) return [];
      const { data } = await (supabase as any)
        .from('live_call_transcripts')
        .select('*')
        .eq('call_sid', callSid)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!selectedCall,
  });

  // ── Playbook History ──
  const { data: playbookHistory = [] } = useQuery({
    queryKey: ['dc-playbook-history'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('playbook_history')
        .select('*')
        .order('date', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // ── Self-Learn ──
  const selfLearn = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('agent-self-learn');
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => toast.success(data?.top_insight || 'Self-learn completed'),
    onError: (e: any) => toast.error('Self-learn failed: ' + e.message),
  });

  // ── Filters ──
  const filtered = useMemo(() => {
    return callLogs.filter((c: any) => {
      if (search && !(c.phone_number || '').includes(search) && !(c.ai_summary || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (outcomeFilter !== 'all' && c.outcome !== outcomeFilter) return false;
      if (agentFilter !== 'all' && c.persona_id !== agentFilter) return false;
      return true;
    });
  }, [callLogs, search, outcomeFilter, agentFilter]);

  // ── Summary Stats ──
  const stats = useMemo(() => {
    const total = callLogs.length;
    if (!total) return { total: 0, winRate: '0', topOutcome: '—' };
    const wins = callLogs.filter((c: any) => isWin(c.outcome)).length;
    const winRate = ((wins / total) * 100).toFixed(1);
    const counts: Record<string, number> = {};
    callLogs.forEach((c: any) => { const o = c.outcome || 'no-decision'; counts[o] = (counts[o] || 0) + 1; });
    const topOutcome = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || '—';
    return { total, winRate, topOutcome };
  }, [callLogs]);

  // ── Analytics for charts ──
  const analytics = useMemo(() => {
    if (!callLogs.length) return null;
    const outcomeCounts: Record<string, number> = {};
    const durationByOutcome: Record<string, { total: number; count: number }> = {};
    const agentWins: Record<string, { wins: number; total: number }> = {};
    const dailyVolume: Record<string, number> = {};

    callLogs.forEach((c: any) => {
      const o = c.outcome || 'no-decision';
      outcomeCounts[o] = (outcomeCounts[o] || 0) + 1;
      if (!durationByOutcome[o]) durationByOutcome[o] = { total: 0, count: 0 };
      if (c.duration_seconds) { durationByOutcome[o].total += c.duration_seconds; durationByOutcome[o].count++; }
      const aid = c.persona_id || 'unknown';
      if (!agentWins[aid]) agentWins[aid] = { wins: 0, total: 0 };
      agentWins[aid].total++;
      if (isWin(o)) agentWins[aid].wins++;
      const day = (c.created_at || '').slice(0, 10);
      if (day) dailyVolume[day] = (dailyVolume[day] || 0) + 1;
    });

    const pieData = Object.entries(outcomeCounts).map(([name, value]) => ({ name, value }));
    const durationData = Object.entries(durationByOutcome).filter(([, v]) => v.count > 0).map(([name, v]) => ({ name, avg: Math.round(v.total / v.count) }));
    const bestAgent = Object.entries(agentWins).filter(([, v]) => v.total >= 3).sort(([, a], [, b]) => (b.wins / b.total) - (a.wins / a.total))[0];
    const volumeData = Object.entries(dailyVolume).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, count]) => ({ date: date.slice(5), count }));

    return { pieData, durationData, bestAgent, volumeData, outcomeCounts, total: callLogs.length };
  }, [callLogs]);

  return (
    <div className="flex h-full">
      <div className={cn('flex-1 space-y-6 overflow-auto', selectedCall && 'pr-4')}>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#0F6E56]" /> Call Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">
            {callLogs.length} calls logged · Click any row to view transcript
          </p>
        </div>

        {/* ── Win/Loss Summary Cards ── */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-[#0F6E56]/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#0F6E56]" />
                <div>
                  <p className="text-xl font-bold font-mono">{stats.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#0F6E56]/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#0F6E56]" />
                <div>
                  <p className="text-xl font-bold font-mono">{stats.winRate}%</p>
                  <p className="text-[10px] text-muted-foreground">Win Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#0F6E56]/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#0F6E56]" />
                <div>
                  <p className="text-xl font-bold font-mono capitalize">{stats.topOutcome}</p>
                  <p className="text-[10px] text-muted-foreground">Top Outcome</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="calls">
          <TabsList>
            <TabsTrigger value="calls">Call Log</TabsTrigger>
            <TabsTrigger value="analysis">Win/Loss Analysis</TabsTrigger>
            <TabsTrigger value="selflearn">Self-Learn Console</TabsTrigger>
          </TabsList>

          {/* ── TAB: Call Log ── */}
          <TabsContent value="calls" className="space-y-4 mt-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search phone or summary…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  {['booked', 'interested', 'callback', 'not-interested', 'voicemail', 'no-decision', 'wrong-number'].map(o =>
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {AGENTS.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {analytics && (
              <div className="flex gap-2 flex-wrap">
                {Object.entries(analytics.outcomeCounts).sort(([, a], [, b]) => b - a).map(([outcome, count]) => (
                  <Badge key={outcome} variant="outline" className={cn('cursor-pointer', outcomeStyle(outcome))}
                    onClick={() => setOutcomeFilter(outcomeFilter === outcome ? 'all' : outcome)}>
                    {outcome}: {count} ({((count / analytics.total) * 100).toFixed(0)}%)
                  </Badge>
                ))}
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No calls match your filters.</p>
              </CardContent></Card>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-4 py-2 font-medium">Date/Time</th>
                      <th className="px-4 py-2 font-medium">Outcome</th>
                      <th className="px-4 py-2 font-medium hidden sm:table-cell text-right">Duration</th>
                      <th className="px-4 py-2 font-medium hidden md:table-cell">Transcript Preview</th>
                      <th className="px-4 py-2 font-medium text-right">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((call: any) => {
                      const preview = call.full_transcript ? call.full_transcript.substring(0, 60) + '…' : call.ai_summary || '—';
                      return (
                        <tr key={call.id}
                          className={cn('border-t cursor-pointer transition-colors', selectedCall?.id === call.id ? 'bg-primary/5' : 'hover:bg-muted/30')}
                          onClick={() => setSelectedCall(call)}>
                          <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(call.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className={cn('text-[10px]', outcomeStyle(call.outcome || ''))}>{call.outcome || 'pending'}</Badge>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums hidden sm:table-cell text-xs">{fmtDur(call.duration_seconds)}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[200px] hidden md:table-cell">{preview}</td>
                          <td className="px-4 py-2 text-right">
                            <Button variant="ghost" size="sm" className="text-xs h-7">View</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── TAB: Win/Loss Analysis ── */}
          <TabsContent value="analysis" className="space-y-4 mt-4">
            {!analytics ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No data yet.</CardContent></Card>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Outcome Distribution</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={analytics.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                            {analytics.pieData.map((entry: any) => (
                              <Cell key={entry.name} fill={OUTCOME_COLORS[entry.name] || '#6b7280'} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {analytics.pieData.map((d: any) => (
                          <span key={d.name} className="text-[10px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: OUTCOME_COLORS[d.name] || '#6b7280' }} />
                            {d.name} ({d.value})
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Avg Duration by Outcome (s)</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.durationData}>
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Call Volume — Last 30 Days</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={analytics.volumeData}>
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                {analytics.bestAgent && (
                  <Card>
                    <CardContent className="py-4 flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-[#0F6E56]" />
                      <div>
                        <p className="text-sm font-medium">Top Performer: {agentName(analytics.bestAgent[0])}</p>
                        <p className="text-xs text-muted-foreground">
                          {analytics.bestAgent[1].wins} wins / {analytics.bestAgent[1].total} calls
                          ({((analytics.bestAgent[1].wins / analytics.bestAgent[1].total) * 100).toFixed(1)}%)
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ── TAB: Self-Learn Console ── */}
          <TabsContent value="selflearn" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-[#0F6E56]" /> Self-Learn Console
                </h2>
                <p className="text-xs text-muted-foreground">Next scheduled run: 2am ET tonight</p>
              </div>
              <Button onClick={() => selfLearn.mutate()} disabled={selfLearn.isPending} size="sm" className="bg-[#0F6E56] hover:bg-[#0F6E56]/80 text-white">
                {selfLearn.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Running…</> : <><Zap className="h-4 w-4 mr-1" /> Trigger Self-Learn</>}
              </Button>
            </div>

            {playbookHistory.length === 0 ? (
              <Card className="border-[#0F6E56]/20">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No analysis runs yet — make your first AI call, then trigger the self-learn engine</p>
                  <Button onClick={() => selfLearn.mutate()} disabled={selfLearn.isPending} size="sm" variant="outline" className="mt-4">
                    <Zap className="h-3 w-3 mr-1" /> Trigger Self-Learn
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {playbookHistory.map((run: any) => (
                  <PlaybookRunCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Transcript Slide Panel (desktop) ── */}
      {selectedCall && (
        <div className="w-[380px] shrink-0 border-l bg-card overflow-auto hidden lg:block">
          <TranscriptDrawer call={selectedCall} transcripts={transcripts} onClose={() => setSelectedCall(null)} />
        </div>
      )}
      {/* ── Mobile overlay ── */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 bg-background lg:hidden overflow-auto">
          <TranscriptDrawer call={selectedCall} transcripts={transcripts} onClose={() => setSelectedCall(null)} />
        </div>
      )}
    </div>
  );
}

// ── Transcript Drawer with chat bubble formatting ──
function TranscriptDrawer({ call, transcripts, onClose }: { call: any; transcripts: any[]; onClose: () => void }) {
  // Parse full_transcript into chat lines if no structured transcripts
  const chatLines = useMemo(() => {
    if (transcripts.length > 0) return null; // use structured transcripts instead
    if (!call.full_transcript) return null;
    return parseTranscriptLines(call.full_transcript);
  }, [call.full_transcript, transcripts]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Call Transcript</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={outcomeStyle(call.outcome || '')}>{call.outcome || 'pending'}</Badge>
          <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />{fmtDur(call.duration_seconds)}</Badge>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {call.phone_number || '—'}</p>
          <p className="flex items-center gap-1"><Bot className="h-3 w-3" /> {agentName(call.persona_id)}</p>
          <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(call.created_at).toLocaleString()}</p>
        </div>
      </div>

      {call.ai_summary && (
        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">AI Summary</p>
          <p className="text-xs">{call.ai_summary}</p>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">Conversation</p>
        <div className="space-y-2 max-h-[50vh] overflow-auto">
          {transcripts.length > 0 ? (
            transcripts.map((t: any) => {
              const isAI = t.speaker === 'ai';
              return (
                <div key={t.id} className={cn('flex', isAI ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-xs',
                    isAI ? 'bg-[#0F6E56]/15 text-[#4fd1a5]' : 'bg-muted text-muted-foreground'
                  )}>
                    <span className="text-[9px] font-bold uppercase block mb-0.5 opacity-70">{t.speaker}</span>
                    {t.text || t.message}
                  </div>
                </div>
              );
            })
          ) : chatLines ? (
            chatLines.map((line) => {
              const isAI = line.speaker === 'ai';
              const isCaller = line.speaker === 'caller';
              return (
                <div key={line.id} className={cn('flex', isAI ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-xs',
                    isAI ? 'bg-[#0F6E56]/15 text-[#4fd1a5]' : isCaller ? 'bg-muted text-muted-foreground' : 'bg-muted/50 text-muted-foreground italic'
                  )}>
                    {(isAI || isCaller) && (
                      <span className="text-[9px] font-bold uppercase block mb-0.5 opacity-70">{isAI ? 'AI' : 'CALLER'}</span>
                    )}
                    {line.text}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-muted/30 p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Transcript not yet available</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-3">
        <Badge variant="outline" className={cn('text-xs', outcomeStyle(call.outcome || ''))}>
          Final: {call.outcome || 'pending'}
        </Badge>
      </div>
    </div>
  );
}

// ── Playbook Run Card ──
function PlaybookRunCard({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CardContent className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs font-mono">{run.date || (run.created_at || '').slice(0, 10)}</Badge>
                {run.agent_name && <Badge variant="outline" className="text-[10px]">{run.agent_name}</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{run.calls_analyzed ?? 0} calls</span>
                <span className="text-green-500">{run.wins_analyzed ?? run.wins ?? 0}W</span>
                <span className="text-red-500">{run.losses_analyzed ?? run.losses ?? 0}L</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
              </div>
            </div>
          </CollapsibleTrigger>

          {run.top_insight && (
            <p className="text-xs mt-2 font-medium">💡 {run.top_insight}</p>
          )}

          <CollapsibleContent className="mt-3">
            <div className="bg-muted/30 rounded p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-auto">
              {run.update_content || 'No playbook content recorded.'}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
