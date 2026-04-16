import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Eye, Phone, Clock, Flame, TrendingUp, BarChart3, Star, MessageSquare } from 'lucide-react';

const QUALITY_BADGE: Record<string, { emoji: string; class: string }> = {
  hot: { emoji: '🔥', class: 'bg-red-500/10 text-red-500 border-red-500' },
  warm: { emoji: '🟡', class: 'bg-yellow-500/10 text-yellow-500 border-yellow-500' },
  cold: { emoji: '🔵', class: 'bg-blue-500/10 text-blue-500 border-blue-500' },
  dead: { emoji: '⚫', class: 'bg-muted text-muted-foreground' },
};

export default function DCCallResults() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [bizFilter, setBizFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [selectedCall, setSelectedCall] = useState<any>(null);

  const { data: results = [] } = useQuery({
    queryKey: ['dynasty-call-results', bizFilter, qualityFilter],
    queryFn: async () => {
      let q = (supabase as any).from('dynasty_ai_calls').select('*').order('created_at', { ascending: false }).limit(200);
      if (bizFilter !== 'all') q = q.eq('business_unit', bizFilter);
      if (qualityFilter !== 'all') q = q.eq('lead_quality', qualityFilter);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ['dynasty-call-analyses'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dynasty_call_analysis').select('*');
      return data || [];
    },
  });

  // Realtime for hot leads
  useEffect(() => {
    const channel = supabase.channel('dc-results')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dynasty_call_analysis' }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ['dynasty-call-results'] });
        qc.invalidateQueries({ queryKey: ['dynasty-call-analyses'] });
        if (payload.new?.lead_quality === 'hot') toast.success('🔥 Hot lead detected!');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const analysisMap = analyses.reduce((acc: any, a: any) => { acc[a.call_id] = a; return acc; }, {});

  const filtered = results.filter((r: any) => {
    if (search && !r.to_number?.includes(search) && !r.contact_name?.toLowerCase().includes(search.toLowerCase()) && !r.company_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hotCount = results.filter((r: any) => r.lead_quality === 'hot').length;
  const avgScore = analyses.length > 0 ? Math.round(analyses.reduce((s: number, a: any) => s + (a.overall_score || 0), 0) / analyses.length) : 0;

  const ScoreBar = ({ label, score }: { label: string; score: number }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs w-32 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${score * 10}%` }} /></div>
      <span className="text-xs font-mono w-8">{score}/10</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">📊 Call Results</h1><p className="text-sm text-muted-foreground">View call results with AI analysis</p></div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center"><Phone className="h-5 w-5 mx-auto mb-1 text-primary" /><p className="text-2xl font-bold">{results.length}</p><p className="text-xs text-muted-foreground">Total Calls</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Flame className="h-5 w-5 mx-auto mb-1 text-red-500" /><p className="text-2xl font-bold">{hotCount}</p><p className="text-xs text-muted-foreground">Hot Leads</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" /><p className="text-2xl font-bold">{avgScore}/10</p><p className="text-xs text-muted-foreground">Avg Score</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="text-2xl font-bold">{results.length > 0 ? Math.round(results.reduce((s: number, r: any) => s + (r.duration_seconds || 0), 0) / results.length) : 0}s</p><p className="text-xs text-muted-foreground">Avg Duration</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={bizFilter} onValueChange={setBizFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Businesses</SelectItem>
            <SelectItem value="brandaro">Brandaro</SelectItem>
            <SelectItem value="surplus_funds">Surplus Funds</SelectItem>
            <SelectItem value="wholesale_re">Wholesale RE</SelectItem>
            <SelectItem value="gasmask">GasMask</SelectItem>
          </SelectContent>
        </Select>
        <Select value={qualityFilter} onValueChange={setQualityFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quality</SelectItem>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="warm">🟡 Warm</SelectItem>
            <SelectItem value="cold">🔵 Cold</SelectItem>
            <SelectItem value="dead">⚫ Dead</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">Time</th><th className="p-3">Source</th><th className="p-3">Business</th><th className="p-3">Contact</th><th className="p-3">Phone</th><th className="p-3">Duration</th><th className="p-3">Quality</th><th className="p-3">Score</th><th className="p-3">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((r: any) => {
                  const analysis = analysisMap[r.call_id];
                  const q = QUALITY_BADGE[r.lead_quality] || QUALITY_BADGE.cold;
                  return (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-accent/50">
                      <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="p-3">
                        {r.source_table ? (
                          <Badge variant="outline" className={
                            r.source_table === 'brandaro_qualified_leads'
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 text-[10px]'
                              : 'bg-muted text-muted-foreground text-[10px]'
                          }>
                            {r.source_table === 'brandaro_qualified_leads' ? '🅱️ Brandaro' : r.source_table.replace(/_/g, ' ')}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Direct</span>
                        )}
                      </td>
                      <td className="p-3"><Badge variant="outline">{r.business_unit}</Badge></td>
                      <td className="p-3 font-medium">{r.contact_name || '-'}<br /><span className="text-xs text-muted-foreground">{r.company_name}</span></td>
                      <td className="p-3 font-mono text-xs">{r.to_number}</td>
                      <td className="p-3">{r.duration_seconds ? `${r.duration_seconds}s` : '-'}</td>
                      <td className="p-3">{r.lead_quality && <Badge variant="outline" className={q.class}>{q.emoji} {r.lead_quality}</Badge>}</td>
                      <td className="p-3">{analysis ? <span className={`font-bold ${analysis.overall_score >= 7 ? 'text-green-500' : analysis.overall_score >= 4 ? 'text-yellow-500' : 'text-red-500'}`}>{analysis.overall_score}/10</span> : '-'}</td>
                      <td className="p-3"><Button size="sm" variant="ghost" onClick={() => setSelectedCall({ ...r, analysis })}><Eye className="h-3 w-3 mr-1" /> View</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedCall && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Call Details — {selectedCall.contact_name || selectedCall.to_number}
                  {selectedCall.lead_quality && <Badge variant="outline" className={QUALITY_BADGE[selectedCall.lead_quality]?.class}>{QUALITY_BADGE[selectedCall.lead_quality]?.emoji} {selectedCall.lead_quality}</Badge>}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Business:</span> {selectedCall.business_unit}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {selectedCall.to_number}</div>
                  <div><span className="text-muted-foreground">Duration:</span> {selectedCall.duration_seconds}s</div>
                  <div><span className="text-muted-foreground">Time:</span> {new Date(selectedCall.created_at).toLocaleString()}</div>
                </div>

                {selectedCall.analysis ? (
                  <>
                    {/* Score */}
                    <Card><CardContent className="pt-4">
                      <div className="text-center mb-4">
                        <p className="text-4xl font-bold">{selectedCall.analysis.overall_score}<span className="text-lg text-muted-foreground">/10</span></p>
                        <p className="text-sm text-muted-foreground">Overall Score</p>
                      </div>
                      <div className="space-y-2">
                        <ScoreBar label="Rapport" score={selectedCall.analysis.rapport_score} />
                        <ScoreBar label="Objection Handling" score={selectedCall.analysis.objection_handling_score} />
                        <ScoreBar label="Qualification" score={selectedCall.analysis.qualification_score} />
                        <ScoreBar label="Closing" score={selectedCall.analysis.closing_score} />
                        <ScoreBar label="Energy" score={selectedCall.analysis.energy_score} />
                      </div>
                    </CardContent></Card>

                    {/* Analysis */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Card className="border-green-500/30"><CardHeader className="pb-2"><CardTitle className="text-sm text-green-500">✅ What Went Well</CardTitle></CardHeader><CardContent><ul className="text-sm space-y-1">{selectedCall.analysis.what_went_well?.map((w: string, i: number) => <li key={i}>• {w}</li>)}</ul></CardContent></Card>
                      <Card className="border-yellow-500/30"><CardHeader className="pb-2"><CardTitle className="text-sm text-yellow-500">⚠️ What to Improve</CardTitle></CardHeader><CardContent><ul className="text-sm space-y-1">{selectedCall.analysis.what_to_improve?.map((w: string, i: number) => <li key={i}>• {w}</li>)}</ul></CardContent></Card>
                    </div>

                    {selectedCall.analysis.best_moment && <Card className="bg-green-500/5 border-green-500/20"><CardContent className="pt-4"><p className="text-xs text-green-500 font-medium mb-1">Best Moment</p><p className="text-sm italic">"{selectedCall.analysis.best_moment}"</p></CardContent></Card>}
                    {selectedCall.analysis.worst_moment && <Card className="bg-red-500/5 border-red-500/20"><CardContent className="pt-4"><p className="text-xs text-red-500 font-medium mb-1">Worst Moment</p><p className="text-sm italic">"{selectedCall.analysis.worst_moment}"</p></CardContent></Card>}
                    {selectedCall.analysis.specific_coaching && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">🎯 Coaching</CardTitle></CardHeader><CardContent><p className="text-sm">{selectedCall.analysis.specific_coaching}</p></CardContent></Card>}
                  </>
                ) : (
                  <Card><CardContent className="pt-4 text-center text-muted-foreground"><p>Analysis pending or not available</p></CardContent></Card>
                )}

                {/* Transcript */}
                {selectedCall.transcript && (
                  <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Transcript</CardTitle></CardHeader>
                    <CardContent><div className="max-h-60 overflow-y-auto text-xs font-mono whitespace-pre-wrap bg-muted/50 p-3 rounded">{selectedCall.transcript}</div></CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
