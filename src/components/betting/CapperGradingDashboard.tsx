import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Crown, Flame, Trophy, Users, Brain, Target, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, Loader2, BarChart3, Shield, Zap
} from 'lucide-react';
import { toast } from 'sonner';

const GRADE_CONFIG: Record<string, { color: string; label: string }> = {
  A: { color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10', label: 'ELITE' },
  B: { color: 'text-blue-400 border-blue-400/30 bg-blue-400/10', label: 'STRONG' },
  C: { color: 'text-amber-400 border-amber-400/30 bg-amber-400/10', label: 'AVERAGE' },
  D: { color: 'text-red-400 border-red-400/30 bg-red-400/10', label: 'WEAK' },
};

// ── Capper Profile Card ──
function CapperProfileCard({ capper }: { capper: any }) {
  const g = GRADE_CONFIG[capper.grade || 'D'] || GRADE_CONFIG.D;
  const roi = capper.roi_pct || 0;
  const wr = capper.win_rate || 0;
  const hot = capper.hot_streak || 0;
  const cold = capper.cold_streak || 0;

  return (
    <Card className={`border-border/50 hover:border-border transition-colors`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black">{capper.name}</span>
            <Badge variant="outline" className={`text-[9px] font-bold ${g.color}`}>
              {capper.grade || 'D'} · {g.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {roi > 5 && <Badge variant="outline" className="text-[8px] text-amber-400 border-amber-400/30">💰 HIGH ROI</Badge>}
            {wr < 45 && (capper.total_picks || 0) >= 5 && <Badge variant="outline" className="text-[8px] text-red-400 border-red-400/30">⚠️ RISKY</Badge>}
            {hot >= 3 && <Badge variant="outline" className="text-[8px] text-emerald-400 border-emerald-400/30">🔥 HOT</Badge>}
            {cold >= 3 && <Badge variant="outline" className="text-[8px] text-blue-400 border-blue-400/30">❄️ COLD</Badge>}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded border border-border/30">
            <span className={`text-sm font-black ${roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {roi > 0 ? '+' : ''}{roi}%
            </span>
            <p className="text-[8px] text-muted-foreground tracking-widest">ROI</p>
          </div>
          <div className="p-2 rounded border border-border/30">
            <span className={`text-sm font-black ${wr >= 55 ? 'text-emerald-400' : wr >= 50 ? 'text-foreground' : 'text-red-400'}`}>
              {wr}%
            </span>
            <p className="text-[8px] text-muted-foreground tracking-widest">WIN RATE</p>
          </div>
          <div className="p-2 rounded border border-border/30">
            <span className="text-sm font-black">{capper.total_picks || 0}</span>
            <p className="text-[8px] text-muted-foreground tracking-widest">PICKS</p>
          </div>
          <div className="p-2 rounded border border-border/30">
            {hot > 0 ? (
              <span className="text-sm font-black text-emerald-400">🔥 {hot}</span>
            ) : cold > 0 ? (
              <span className="text-sm font-black text-blue-400">❄️ {cold}</span>
            ) : (
              <span className="text-sm font-black text-muted-foreground">—</span>
            )}
            <p className="text-[8px] text-muted-foreground tracking-widest">STREAK</p>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Best Market: <span className="text-foreground font-bold">{capper.best_market || '—'}</span></span>
          <span>Weight: <span className="text-foreground font-bold">{capper.capper_weight || 1.0}x</span></span>
          <span>Source: <span className="text-foreground">{capper.source || 'telegram'}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Review Queue ──
function ReviewQueue() {
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState<string | null>(null);

  const { data: reviewItems = [], isLoading } = useQuery({
    queryKey: ['match-review-queue'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_external_match_logs')
        .select('id, pick_id, external_result_id, match_type, match_confidence, match_details, result, created_at, sbo_capper_picks(player_name, prop_type, line, direction, game_date, sport)')
        .eq('result', 'needs_review')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const handleResolve = async (logId: string, pickId: string, propId: string, action: 'approve' | 'reject') => {
    setResolving(logId);
    try {
      if (action === 'approve') {
        await (supabase as any).from('sbo_capper_picks')
          .update({ matched_prop_id: propId })
          .eq('id', pickId);
        await (supabase as any).from('sbo_external_match_logs')
          .update({ result: 'matched', match_details: { ...(reviewItems.find((r: any) => r.id === logId)?.match_details || {}), manual_approved: true } })
          .eq('id', logId);
        toast.success('Match approved');
      } else {
        await (supabase as any).from('sbo_external_match_logs')
          .update({ result: 'rejected', match_details: { ...(reviewItems.find((r: any) => r.id === logId)?.match_details || {}), manual_rejected: true } })
          .eq('id', logId);
        toast.info('Match rejected');
      }
      queryClient.invalidateQueries({ queryKey: ['match-review-queue'] });
    } catch { toast.error('Failed'); }
    setResolving(null);
  };

  if (isLoading) return <Card><CardContent className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" /> REVIEW QUEUE
          <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-400/30">{reviewItems.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {reviewItems.length === 0 ? (
          <p className="p-4 text-xs text-center text-muted-foreground">No items pending review</p>
        ) : (
          reviewItems.map((item: any) => {
            const pick = item.sbo_capper_picks;
            return (
              <div key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-border/20 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{pick?.player_name || '?'}</span>
                    <Badge variant="outline" className="text-[9px]">{pick?.sport}</Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {pick?.direction} {pick?.line} {pick?.prop_type} · {pick?.game_date}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Method: <span className="text-foreground font-medium">{item.match_type}</span> · Confidence: <span className="text-amber-400 font-bold">{item.match_confidence}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-emerald-400 border-emerald-400/30"
                    onClick={() => handleResolve(item.id, item.pick_id, item.external_result_id, 'approve')}
                    disabled={resolving === item.id}>
                    <CheckCircle className="h-3 w-3" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-red-400 border-red-400/30"
                    onClick={() => handleResolve(item.id, item.pick_id, item.external_result_id, 'reject')}
                    disabled={resolving === item.id}>
                    <XCircle className="h-3 w-3" /> Reject
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ── ROI Breakdown ──
function ROIBreakdown({ capperId }: { capperId: string }) {
  const { data: roiData = [] } = useQuery({
    queryKey: ['capper-roi', capperId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_capper_roi')
        .select('*')
        .eq('capper_id', capperId)
        .order('roi_percentage', { ascending: false });
      return data || [];
    },
    enabled: !!capperId,
  });

  if (roiData.length === 0) return <p className="text-xs text-muted-foreground text-center p-4">No ROI data yet</p>;

  return (
    <div className="space-y-1">
      {roiData.map((r: any) => (
        <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded border border-border/30 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px]">{r.sport}</Badge>
            <span className="font-medium">{r.market_type}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-black ${r.roi_percentage > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {r.roi_percentage > 0 ? '+' : ''}{r.roi_percentage}%
            </span>
            <span className="text-muted-foreground">{r.wins}W-{r.losses}L</span>
            <span className="text-muted-foreground/60">{r.total_bets}b</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──
export function CapperGradingDashboard() {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<'grade' | 'roi' | 'winrate' | 'picks'>('roi');
  const [running, setRunning] = useState(false);
  const [selectedCapper, setSelectedCapper] = useState<any>(null);

  const { data: cappers = [], isLoading } = useQuery({
    queryKey: ['graded-cappers'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_cappers')
        .select('*')
        .eq('is_active', true)
        .order('roi_pct', { ascending: false });
      return data || [];
    },
  });

  const runFullEngine = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-match-capper-picks', {
        body: { mode: 'full' },
      });
      if (error) throw error;
      toast.success(`Engine complete: ${data.matched} matched, ${data.resolved} resolved, ${data.graded} graded${data.needsReview > 0 ? ` (${data.needsReview} need review)` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['graded-cappers'] });
      queryClient.invalidateQueries({ queryKey: ['match-review-queue'] });
    } catch (err: any) {
      toast.error(err.message || 'Engine failed');
    }
    setRunning(false);
  };

  const sorted = [...cappers].sort((a: any, b: any) => {
    if (sortBy === 'grade') return (a.grade || 'D').localeCompare(b.grade || 'D');
    if (sortBy === 'roi') return (b.roi_pct || 0) - (a.roi_pct || 0);
    if (sortBy === 'winrate') return (b.win_rate || 0) - (a.win_rate || 0);
    return (b.total_picks || 0) - (a.total_picks || 0);
  });

  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0 };
  for (const c of cappers) { gradeDistribution[(c.grade || 'D') as keyof typeof gradeDistribution]++; }

  if (isLoading) return <Card><CardContent className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      {/* Header + Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-black tracking-[0.1em]">CAPPER INTELLIGENCE</h2>
            <p className="text-[10px] text-muted-foreground">Grading · ROI · Matching Engine</p>
          </div>
        </div>
        <Button onClick={runFullEngine} disabled={running} className="gap-1.5" size="sm">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Run Full Engine
        </Button>
      </div>

      {/* Grade Distribution KPIs */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(gradeDistribution).map(([grade, count]) => {
          const g = GRADE_CONFIG[grade];
          return (
            <Card key={grade} className="border-border/50">
              <CardContent className="p-3 text-center">
                <Badge variant="outline" className={`text-xs font-black mb-1 ${g.color}`}>{grade}</Badge>
                <p className="text-xl font-black">{count}</p>
                <p className="text-[8px] text-muted-foreground tracking-widest">{g.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sort Control */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground tracking-widest">SORT BY</span>
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="roi">ROI %</SelectItem>
            <SelectItem value="winrate">Win Rate</SelectItem>
            <SelectItem value="grade">Grade</SelectItem>
            <SelectItem value="picks">Total Picks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Capper Profiles */}
        <div className="lg:col-span-2 space-y-2">
          {sorted.map((c: any) => (
            <div key={c.id} className="cursor-pointer" onClick={() => setSelectedCapper(c)}>
              <CapperProfileCard capper={c} />
            </div>
          ))}
          {sorted.length === 0 && (
            <Card className="border-dashed"><CardContent className="p-8 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No cappers found</p>
            </CardContent></Card>
          )}
        </div>

        {/* Sidebar: Review Queue */}
        <div className="space-y-4">
          <ReviewQueue />
        </div>
      </div>

      {/* Capper Detail Dialog */}
      <Dialog open={!!selectedCapper} onOpenChange={open => { if (!open) setSelectedCapper(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              {selectedCapper?.name}
              <Badge variant="outline" className={`text-[10px] font-bold ${GRADE_CONFIG[selectedCapper?.grade || 'D']?.color}`}>
                Grade {selectedCapper?.grade || 'D'}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedCapper && (
            <div className="space-y-4">
              {/* Summary KPIs */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded border border-border/30">
                  <span className={`font-black ${(selectedCapper.roi_pct || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(selectedCapper.roi_pct || 0) > 0 ? '+' : ''}{selectedCapper.roi_pct || 0}%
                  </span>
                  <p className="text-[8px] text-muted-foreground">ROI</p>
                </div>
                <div className="p-2 rounded border border-border/30">
                  <span className="font-black">{selectedCapper.win_rate || 0}%</span>
                  <p className="text-[8px] text-muted-foreground">WIN RATE</p>
                </div>
                <div className="p-2 rounded border border-border/30">
                  <span className="font-black">{selectedCapper.total_picks || 0}</span>
                  <p className="text-[8px] text-muted-foreground">PICKS</p>
                </div>
                <div className="p-2 rounded border border-border/30">
                  <span className="font-black">{selectedCapper.capper_weight || 1.0}x</span>
                  <p className="text-[8px] text-muted-foreground">WEIGHT</p>
                </div>
              </div>

              {/* ROI by Market */}
              <div>
                <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" /> ROI BY MARKET
                </h3>
                <ROIBreakdown capperId={selectedCapper.id} />
              </div>

              {/* Meta */}
              <div className="text-[10px] text-muted-foreground space-y-0.5 border-t border-border/30 pt-3">
                <p>Best Market: <span className="text-foreground font-bold">{selectedCapper.best_market || '—'}</span></p>
                <p>Source: {selectedCapper.source} · Active Since: {new Date(selectedCapper.created_at).toLocaleDateString()}</p>
                <p>Streak: {selectedCapper.hot_streak > 0 ? `🔥 ${selectedCapper.hot_streak}W` : selectedCapper.cold_streak > 0 ? `❄️ ${selectedCapper.cold_streak}L` : 'None'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
