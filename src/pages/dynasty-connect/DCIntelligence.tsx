import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Phone, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
];

const agentName = (id: string) => AGENTS.find(a => a.id === id)?.name || '—';

const outcomeStyle = (o: string) => {
  switch (o) {
    case 'booked': return 'bg-green-500/10 text-green-500 border-green-500';
    case 'interested': return 'bg-amber-500/10 text-amber-500 border-amber-500';
    case 'callback': return 'bg-blue-500/10 text-blue-500 border-blue-500';
    case 'not-interested': case 'wrong-number': return 'bg-red-500/10 text-red-500 border-red-500';
    case 'voicemail': return 'bg-orange-500/10 text-orange-500 border-orange-500';
    default: return 'bg-muted text-muted-foreground';
  }
};

export default function DCIntelligence() {
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');

  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ['dc-call-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Fetch transcripts for selected call
  const { data: transcripts = [] } = useQuery({
    queryKey: ['dc-call-transcripts', selectedCall?.id],
    queryFn: async () => {
      if (!selectedCall) return [];
      // Try provider_call_sid from the call log
      const callSid = (selectedCall as any).call_sid || (selectedCall as any).provider_call_sid;
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

  const filtered = useMemo(() => {
    return callLogs.filter((c: any) => {
      const matchSearch = !search ||
        (c.phone_number || '').includes(search) ||
        (c.ai_summary || '').toLowerCase().includes(search.toLowerCase());
      const matchOutcome = outcomeFilter === 'all' || c.outcome === outcomeFilter;
      return matchSearch && matchOutcome;
    });
  }, [callLogs, search, outcomeFilter]);

  // Win/Loss stats
  const stats = useMemo(() => {
    const total = callLogs.length;
    if (total === 0) return null;
    const counts: Record<string, number> = {};
    callLogs.forEach((c: any) => {
      const o = c.outcome || 'no-decision';
      counts[o] = (counts[o] || 0) + 1;
    });
    return { total, counts };
  }, [callLogs]);

  const speakerColor = (s: string) => {
    if (s === 'ai') return 'text-teal-400';
    if (s === 'caller' || s === 'human') return 'text-muted-foreground';
    return 'text-yellow-400';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Call Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">
          {callLogs.length} calls logged · Click any call to view transcript
        </p>
      </div>

      {/* Win/Loss Summary */}
      {stats && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(stats.counts)
            .sort(([, a], [, b]) => b - a)
            .map(([outcome, count]) => (
              <Badge key={outcome} variant="outline" className={outcomeStyle(outcome)}>
                {outcome}: {count} ({((count / stats.total) * 100).toFixed(0)}%)
              </Badge>
            ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search phone or summary…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="callback">Callback</SelectItem>
            <SelectItem value="not-interested">Not Interested</SelectItem>
            <SelectItem value="voicemail">Voicemail</SelectItem>
            <SelectItem value="wrong-number">Wrong Number</SelectItem>
            <SelectItem value="no-decision">No Decision</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Call Log Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No calls match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Agent</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell text-right">Duration</th>
                <th className="px-4 py-2 font-medium">Outcome</th>
                <th className="px-4 py-2 font-medium hidden lg:table-cell">Summary</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((call: any) => (
                <tr
                  key={call.id}
                  className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedCall(call)}
                >
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(call.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 font-medium">{call.phone_number || '—'}</td>
                  <td className="px-4 py-2 text-xs hidden md:table-cell">{agentName(call.persona_id)}</td>
                  <td className="px-4 py-2 text-right tabular-nums hidden sm:table-cell">
                    {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={outcomeStyle(call.outcome || '')}>
                      {call.outcome || 'pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[200px] hidden lg:table-cell">
                    {call.ai_summary || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transcript Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Call — {selectedCall?.phone_number || 'Unknown'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline" className={outcomeStyle(selectedCall?.outcome || '')}>
                {selectedCall?.outcome || 'pending'}
              </Badge>
              <span className="text-muted-foreground">
                {selectedCall?.duration_seconds ? `${Math.floor(selectedCall.duration_seconds / 60)}m ${selectedCall.duration_seconds % 60}s` : '—'}
              </span>
              <span className="text-muted-foreground">{agentName(selectedCall?.persona_id)}</span>
              <span className="text-muted-foreground">{selectedCall?.language || 'en'}</span>
            </div>

            {selectedCall?.ai_summary && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">AI Summary</p>
                <p className="text-sm">{selectedCall.ai_summary}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Transcript</p>
              <div className="bg-muted/30 p-4 rounded-lg space-y-2 max-h-96 overflow-auto">
                {transcripts.length > 0 ? (
                  transcripts.map((t: any) => (
                    <div key={t.id} className="flex gap-2">
                      <span className={`text-xs font-bold uppercase w-14 flex-shrink-0 ${speakerColor(t.speaker)}`}>
                        {t.speaker}
                      </span>
                      <span className="text-sm">{t.text}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm whitespace-pre-wrap font-mono text-xs">
                    {selectedCall?.transcription || selectedCall?.full_transcript || 'No transcript available.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
