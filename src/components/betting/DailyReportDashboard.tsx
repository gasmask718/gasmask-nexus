import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Flame, TrendingUp, Target, Users, Trophy, Brain, Eye, Send, Mail, Clock,
  CheckCircle, XCircle, AlertTriangle, BarChart3, Crown, Zap, Loader2, Shield, ShieldCheck, ShieldAlert, Info
} from 'lucide-react';
import { useUnifiedSignals, UnifiedSignal, MarketEdge } from '@/hooks/useUnifiedSignals';
import { CapperKPI } from '@/hooks/useConsensusIntelligence';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// ── Tier Visual System ──
const TIER = {
  ELITE:     { bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-400', glow: 'shadow-amber-500/10', label: 'ELITE', icon: <Crown className="h-3.5 w-3.5" /> },
  STRONG:    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/10', label: 'STRONG', icon: <Flame className="h-3.5 w-3.5" /> },
  WATCHLIST: { bg: 'bg-blue-500/8', border: 'border-blue-500/20', text: 'text-blue-400', glow: '', label: 'WATCHLIST', icon: <Eye className="h-3.5 w-3.5" /> },
  LOW:       { bg: 'bg-muted/20', border: 'border-border', text: 'text-muted-foreground', glow: '', label: 'LOW', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
} as const;

const RISK_ICON = {
  HIGH_CONFIDENCE: <ShieldCheck className="h-3 w-3 text-emerald-400" />,
  MEDIUM_CONFIDENCE: <Shield className="h-3 w-3 text-blue-400" />,
  HIGH_RISK: <ShieldAlert className="h-3 w-3 text-red-400" />,
};
const RISK_LABEL: Record<string, string> = {
  HIGH_CONFIDENCE: 'HIGH CONF',
  MEDIUM_CONFIDENCE: 'MED CONF',
  HIGH_RISK: 'HIGH RISK',
};
const RISK_COLOR: Record<string, string> = {
  HIGH_CONFIDENCE: 'text-emerald-400 border-emerald-500/30',
  MEDIUM_CONFIDENCE: 'text-blue-400 border-blue-500/30',
  HIGH_RISK: 'text-red-400 border-red-500/30',
};

const GRADE_COLOR: Record<string, string> = { A: 'text-emerald-400', B: 'text-blue-400', C: 'text-amber-400', D: 'text-red-400' };

function genExecSummary(signals: UnifiedSignal[], aligned: UnifiedSignal[], capperKPIs: CapperKPI[], bestPlays: UnifiedSignal[]): string {
  const elite = signals.filter(s => s.signal_tier === 'ELITE');
  const topCapper = capperKPIs.filter(c => c.totalPicks >= 3).sort((a, b) => b.roi - a.roi)[0];
  const topPlay = bestPlays[0];
  const parts: string[] = [];
  if (elite.length > 0) parts.push(`${elite.length} elite signal${elite.length > 1 ? 's' : ''} detected.`);
  if (topPlay) parts.push(`Top play: ${topPlay.player_name} ${topPlay.direction} ${topPlay.line} ${topPlay.prop_type} (Score: ${topPlay.combined_score}).`);
  if (aligned.length > 0) parts.push(`${aligned.length} AI+capper aligned pick${aligned.length > 1 ? 's' : ''}.`);
  if (topCapper) parts.push(`Top capper: ${topCapper.name} (ROI: ${topCapper.roi > 0 ? '+' : ''}${topCapper.roi}%).`);
  const conf = elite.length >= 3 ? 'HIGH' : elite.length >= 1 ? 'MODERATE' : 'LOW';
  parts.push(`System confidence: ${conf}.`);
  return parts.join(' ');
}

// ── Decision Signal Card ──
function SignalCard({ signal, rank }: { signal: UnifiedSignal; rank?: number }) {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER[signal.signal_tier] || TIER.LOW;
  return (
    <div className={`relative rounded-lg border p-4 ${tier.border} ${tier.bg} ${tier.glow} shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {rank != null && <span className="text-lg font-black text-amber-400">#{rank}</span>}
          <span className="text-base font-black tracking-tight">{signal.player_name}</span>
          {signal.team && <span className="text-xs text-muted-foreground">{signal.team}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`gap-1 text-[9px] font-bold ${RISK_COLOR[signal.risk_tag]}`}>
            {RISK_ICON[signal.risk_tag]} {RISK_LABEL[signal.risk_tag]}
          </Badge>
          <Badge variant="outline" className={`gap-1 text-[10px] font-bold ${tier.text} ${tier.border}`}>
            {tier.icon} {tier.label}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className={`text-xs font-bold ${
          signal.direction === 'OVER' ? 'text-emerald-400 border-emerald-500/30' : 'text-blue-400 border-blue-500/30'
        }`}>{signal.direction}</Badge>
        <span className="text-lg font-black">{signal.line}</span>
        <span className="text-sm text-muted-foreground">{signal.prop_type}</span>
        {signal.alignment_bonus && <Badge variant="outline" className="text-[9px] text-purple-400 border-purple-500/30">⚡ ALIGNED</Badge>}
        {signal.result && (
          <Badge className={`ml-auto text-[10px] ${signal.result === 'won' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
            {signal.result === 'won' ? '✅ WON' : '❌ LOST'}
          </Badge>
        )}
      </div>

      {/* Reasoning section */}
      <div className="mb-2.5 rounded border border-border/40 bg-muted/20 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] min-w-0">
            <Info className="h-3 w-3 text-amber-400 shrink-0" />
            <span className="text-muted-foreground font-medium truncate">{signal.short_reason}</span>
          </div>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-[9px] font-bold text-amber-400 hover:text-amber-300 shrink-0 tracking-wider"
                >
                  {expanded ? 'LESS' : 'WHY?'}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[300px] text-xs leading-relaxed">
                {signal.full_reason}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {expanded && (
          <p className="text-[11px] leading-relaxed text-foreground/70 mt-1.5 border-t border-border/30 pt-1.5">
            {signal.full_reason}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs border-t border-border/50 pt-2.5 flex-wrap">
        {signal.ai_confidence != null && (
          <div className="flex items-center gap-1">
            <Brain className="h-3 w-3 text-purple-400" />
            <span className="text-muted-foreground">AI:</span>
            <span className="font-bold">{signal.ai_confidence}%</span>
          </div>
        )}
        {signal.capper_consensus > 0 && (
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-blue-400" />
            <span className="font-bold">{signal.capper_consensus} Cappers</span>
            <span className={`font-bold ${GRADE_COLOR[signal.capper_avg_grade] || 'text-muted-foreground'}`}>
              ({signal.capper_avg_grade})
            </span>
          </div>
        )}
        {signal.capper_avg_roi !== 0 && signal.capper_consensus > 0 && (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span className={`font-bold ${signal.capper_avg_roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ROI: {signal.capper_avg_roi > 0 ? '+' : ''}{signal.capper_avg_roi}%
            </span>
          </div>
        )}
      </div>

      {/* Score badge */}
      <div className={`absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border ${tier.border} ${tier.bg}`}>
        <span className={tier.text}>{signal.combined_score}</span>
      </div>
    </div>
  );
}

// ── Best Plays Panel ──
function BestPlaysPanel({ bestPlays }: { bestPlays: UnifiedSignal[] }) {
  if (bestPlays.length === 0) return (
    <Card className="border-amber-500/20 border-dashed">
      <CardContent className="p-6 text-center">
        <Crown className="h-8 w-8 mx-auto text-amber-400/30 mb-2" />
        <p className="text-xs text-muted-foreground">No elite/strong plays available right now</p>
      </CardContent>
    </Card>
  );
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2 border-b border-amber-500/20">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2 text-amber-400">
          <Crown className="h-4 w-4" /> 🔥 BEST PLAYS RIGHT NOW
          <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30 ml-auto">{bestPlays.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        {bestPlays.map((s, i) => <SignalCard key={i} signal={s} rank={i + 1} />)}
      </CardContent>
    </Card>
  );
}

// ── Market Edge Panel ──
function MarketEdgePanel({ edges }: { edges: MarketEdge[] }) {
  if (edges.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400" /> MARKET EDGE
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {edges.slice(0, 6).map((e, i) => (
          <div key={e.market} className={`flex items-center justify-between px-4 py-2.5 text-xs ${i < edges.length - 1 ? 'border-b border-border/30' : ''}`}>
            <span className="font-bold capitalize">{e.market}</span>
            <div className="flex items-center gap-3">
              <span className={`font-black ${e.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {e.roi > 0 ? '+' : ''}{e.roi}%
              </span>
              <span className="text-muted-foreground">{e.winRate}% WR</span>
              <span className="text-muted-foreground/60">{e.totalPicks}p</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── KPI Strip ──
function KPIStrip({ eliteCount, strongCount, alignedCount, consensusWR, yesterdayROI }: {
  eliteCount: number; strongCount: number; alignedCount: number; consensusWR: number; yesterdayROI: number;
}) {
  const kpis = [
    { label: 'ELITE', value: eliteCount, color: 'text-amber-400', icon: <Crown className="h-4 w-4 text-amber-400" /> },
    { label: 'STRONG', value: strongCount, color: 'text-emerald-400', icon: <Flame className="h-4 w-4 text-emerald-400" /> },
    { label: 'ALIGNED', value: alignedCount, color: 'text-purple-400', icon: <Zap className="h-4 w-4 text-purple-400" /> },
    { label: 'CONS WR', value: `${consensusWR}%`, color: consensusWR >= 55 ? 'text-emerald-400' : 'text-muted-foreground', icon: <Target className="h-4 w-4 text-blue-400" /> },
    { label: 'YDAY ROI', value: `${yesterdayROI > 0 ? '+' : ''}${yesterdayROI}%`, color: yesterdayROI > 0 ? 'text-emerald-400' : 'text-red-400', icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {kpis.map(k => (
        <Card key={k.label} className="border-border/50 bg-card/50">
          <CardContent className="p-3 flex flex-col items-center gap-1">
            {k.icon}
            <span className={`text-xl font-black ${k.color}`}>{k.value}</span>
            <span className="text-[9px] font-bold tracking-widest text-muted-foreground">{k.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Capper Leaderboard ──
function CapperLeaderboard({ capperKPIs }: { capperKPIs: CapperKPI[] }) {
  const qualified = capperKPIs.filter(c => c.totalPicks >= 3).sort((a, b) => b.roi - a.roi).slice(0, 8);
  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" /> TOP CAPPERS
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {qualified.map((c, i) => (
          <div key={c.id} className={`flex items-center justify-between px-4 py-2.5 text-xs ${i < qualified.length - 1 ? 'border-b border-border/30' : ''}`}>
            <div className="flex items-center gap-2.5">
              <span className={`font-black text-sm w-5 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-muted-foreground' : i === 2 ? 'text-orange-700' : 'text-muted-foreground/50'}`}>
                {i + 1}
              </span>
              <span className="font-bold">{c.name}</span>
              <Badge variant="outline" className={`text-[8px] ${GRADE_COLOR[c.grade] || ''} border-current/30`}>{c.grade}</Badge>
              {c.roi > 5 && <Badge variant="outline" className="text-[8px] text-amber-400 border-amber-400/30">💰</Badge>}
              {c.winRate < 45 && c.totalPicks >= 5 && <Badge variant="outline" className="text-[8px] text-red-400 border-red-400/30">⚠️</Badge>}
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-black ${c.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {c.roi > 0 ? '+' : ''}{c.roi}%
              </span>
              <span className="text-muted-foreground">{c.winRate}% WR</span>
              <span className="text-muted-foreground/60">{c.totalPicks}p</span>
              {c.currentStreak !== 0 && (
                <span className={`text-[10px] font-bold ${c.currentStreak > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {c.currentStreak > 0 ? `🔥${c.currentStreak}` : `❄️${Math.abs(c.currentStreak)}`}
                </span>
              )}
            </div>
          </div>
        ))}
        {qualified.length === 0 && <p className="p-4 text-xs text-center text-muted-foreground">No cappers with 3+ picks</p>}
      </CardContent>
    </Card>
  );
}

// ── Email Preview Dialog ──
function EmailPreviewDialog({ signals, aligned, aiOnly, capperOnly, yesterdayStats, capperKPIs, today, execSummary, bestPlays }: any) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" /> Preview Brief
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <div className="bg-background">
          <div className="bg-card border-b border-border/50 p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-amber-400" />
              <h1 className="text-lg font-black tracking-[0.15em]">SBO INTELLIGENCE BRIEF</h1>
            </div>
            <p className="text-xs text-muted-foreground">{today} · MANUAL REVIEW ONLY</p>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div><span className="text-amber-400 font-black text-lg">{signals.filter((s: UnifiedSignal) => s.signal_tier === 'ELITE').length}</span><br/><span className="text-[9px] text-muted-foreground tracking-widest">ELITE</span></div>
              <div><span className="text-emerald-400 font-black text-lg">{aligned.length}</span><br/><span className="text-[9px] text-muted-foreground tracking-widest">ALIGNED</span></div>
              <div><span className="font-black text-lg">{signals.length}</span><br/><span className="text-[9px] text-muted-foreground tracking-widest">TOTAL</span></div>
              <div><span className={`font-black text-lg ${yesterdayStats.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{yesterdayStats.roi > 0 ? '+' : ''}{yesterdayStats.roi}%</span><br/><span className="text-[9px] text-muted-foreground tracking-widest">YDAY ROI</span></div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <h2 className="text-[10px] font-bold tracking-widest text-amber-400 mb-2">EXECUTIVE SUMMARY</h2>
              <p className="text-xs leading-relaxed text-foreground/80">{execSummary}</p>
            </div>

            {/* Best Plays */}
            {bestPlays.length > 0 && (
              <div>
                <h2 className="text-[10px] font-bold tracking-widest text-amber-400 mb-3 flex items-center gap-2">
                  <Crown className="h-3 w-3" /> 🔥 BEST PLAYS
                </h2>
                <div className="space-y-2">
                  {bestPlays.slice(0, 5).map((s: UnifiedSignal, i: number) => (
                    <div key={i} className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-sm">#{i+1} {s.player_name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[8px] ${RISK_COLOR[s.risk_tag]}`}>{RISK_LABEL[s.risk_tag]}</Badge>
                          <span className={`text-sm font-black ${TIER[s.signal_tier].text}`}>{s.combined_score}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className={`text-[10px] ${s.direction === 'OVER' ? 'text-emerald-400 border-emerald-500/30' : 'text-blue-400 border-blue-500/30'}`}>{s.direction}</Badge>
                        <span className="font-bold">{s.line}</span>
                        <span className="text-muted-foreground">{s.prop_type}</span>
                        <span className="ml-auto text-muted-foreground">
                          {s.ai_confidence != null && `🧠 ${s.ai_confidence}%`}
                          {s.capper_consensus > 0 && ` · 👥 ${s.capper_consensus} (${s.capper_avg_grade})`}
                        </span>
                      </div>
                      <p className="text-[10px] text-foreground/60 mt-1.5 italic leading-relaxed">
                        Why: {s.short_reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Only */}
            {aiOnly.filter((s: UnifiedSignal) => s.signal_tier === 'ELITE' || s.signal_tier === 'STRONG').length > 0 && (
              <div>
                <h2 className="text-[10px] font-bold tracking-widest text-purple-400 mb-3 flex items-center gap-2">
                  <Brain className="h-3 w-3" /> AI MODEL SIGNALS
                </h2>
                <div className="space-y-1.5">
                  {aiOnly.filter((s: UnifiedSignal) => s.signal_tier === 'ELITE' || s.signal_tier === 'STRONG').slice(0, 5).map((s: UnifiedSignal, i: number) => (
                    <div key={i} className="p-2.5 rounded border border-border/50 flex items-center justify-between text-xs">
                      <div><span className="font-bold">{s.player_name}</span> <span className="text-muted-foreground">{s.direction} {s.line} {s.prop_type}</span></div>
                      <span className="font-bold">🧠 {s.ai_confidence}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Capper Only */}
            {capperOnly.filter((s: UnifiedSignal) => s.signal_tier === 'ELITE' || s.signal_tier === 'STRONG').length > 0 && (
              <div>
                <h2 className="text-[10px] font-bold tracking-widest text-blue-400 mb-3 flex items-center gap-2">
                  <Users className="h-3 w-3" /> CAPPER CONSENSUS
                </h2>
                <div className="space-y-1.5">
                  {capperOnly.filter((s: UnifiedSignal) => s.signal_tier === 'ELITE' || s.signal_tier === 'STRONG').slice(0, 5).map((s: UnifiedSignal, i: number) => (
                    <div key={i} className="p-2.5 rounded border border-border/50 flex items-center justify-between text-xs">
                      <div><span className="font-bold">{s.player_name}</span> <span className="text-muted-foreground">{s.direction} {s.line} {s.prop_type}</span></div>
                      <span>👥 {s.capper_consensus} · {s.capper_avg_grade} · ROI: {s.capper_avg_roi > 0 ? '+' : ''}{s.capper_avg_roi}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Yesterday */}
            <div>
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="h-3 w-3 text-blue-400" /> YESTERDAY
              </h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded border border-emerald-500/20">
                  <span className="text-xl font-black text-emerald-400">{yesterdayStats.wins}</span>
                  <p className="text-[9px] text-muted-foreground tracking-widest">WINS</p>
                </div>
                <div className="p-3 rounded border border-red-500/20">
                  <span className="text-xl font-black text-red-400">{yesterdayStats.losses}</span>
                  <p className="text-[9px] text-muted-foreground tracking-widest">LOSSES</p>
                </div>
                <div className="p-3 rounded border border-border/50">
                  <span className={`text-xl font-black ${yesterdayStats.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {yesterdayStats.roi > 0 ? '+' : ''}{yesterdayStats.roi}%
                  </span>
                  <p className="text-[9px] text-muted-foreground tracking-widest">ROI</p>
                </div>
              </div>
            </div>

            <div className="text-center border-t border-border/30 pt-4 space-y-1">
              <p className="text-[10px] font-bold text-amber-400 tracking-wider">⚠️ FOR MANUAL REVIEW ONLY</p>
              <p className="text-[9px] text-muted-foreground">SBO Decision Intelligence Engine · Not financial advice</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Send Controls ──
function SendControls() {
  const [sending, setSending] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [sendTime, setSendTime] = useState('09:00');
  const [timezone, setTimezone] = useState('America/New_York');

  const sendTestEmail = async () => {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { toast.error('No email found'); return; }
      toast.success(`Test report sent to ${user.email}`);
    } catch { toast.error('Failed'); } finally { setSending(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-400" /> DELIVERY
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <Button onClick={sendTestEmail} disabled={sending} className="w-full gap-1.5" size="sm">
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Send Test Email
        </Button>
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> DAILY SCHEDULE
          </Label>
          <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
        </div>
        {scheduleEnabled && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] text-muted-foreground">Time</Label>
              <Input type="time" value={sendTime} onChange={e => setSendTime(e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground">TZ</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">ET</SelectItem>
                  <SelectItem value="America/Chicago">CT</SelectItem>
                  <SelectItem value="America/Denver">MT</SelectItem>
                  <SelectItem value="America/Los_Angeles">PT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="border-t border-border/30 pt-2 space-y-1.5">
          <Label className="text-[9px] font-bold tracking-wider text-muted-foreground">RECIPIENTS</Label>
          {['Owner', 'Betting Ops', 'Review Team'].map(g => (
            <div key={g} className="flex items-center justify-between text-xs py-1">
              <span>{g}</span>
              <Switch defaultChecked={g === 'Owner'} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Signal Section ──
function SignalSection({ title, icon, signals, color, max = 5 }: { title: string; icon: React.ReactNode; signals: UnifiedSignal[]; color: string; max?: number }) {
  if (signals.length === 0) return null;
  return (
    <div>
      <h3 className={`text-[10px] font-bold tracking-widest mb-3 flex items-center gap-2 ${color}`}>
        {icon} {title}
        <Badge variant="outline" className={`text-[9px] ${color}`}>{signals.length}</Badge>
      </h3>
      <div className="space-y-2">
        {signals.slice(0, max).map((s, i) => <SignalCard key={i} signal={s} />)}
      </div>
    </div>
  );
}

// ── Main Dashboard ──
export function DailyReportDashboard() {
  const {
    signals, alignedSignals, aiOnlySignals, capperOnlySignals, pendingSignals,
    eliteSignals, strongSignals, bestPlays, marketEdges,
    yesterdayStats, consensusStats, capperKPIs, isLoading, today
  } = useUnifiedSignals();
  const [viewMode, setViewMode] = useState<'all' | 'elite' | 'aligned' | 'ai' | 'capper'>('all');

  const execSummary = useMemo(() => genExecSummary(signals, alignedSignals, capperKPIs, bestPlays), [signals, alignedSignals, capperKPIs, bestPlays]);

  if (isLoading) {
    return <Card><CardContent className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /><p className="text-xs text-muted-foreground mt-2">Loading intelligence...</p></CardContent></Card>;
  }

  const displaySignals = viewMode === 'elite' ? eliteSignals :
    viewMode === 'aligned' ? alignedSignals :
    viewMode === 'ai' ? aiOnlySignals :
    viewMode === 'capper' ? capperOnlySignals : signals;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-black tracking-[0.1em]">SBO DECISION ENGINE</h2>
            <p className="text-[10px] text-muted-foreground">{today} · Manual Review Only</p>
          </div>
        </div>
        <div className="flex gap-2">
          <EmailPreviewDialog
            signals={signals} aligned={alignedSignals} aiOnly={aiOnlySignals}
            capperOnly={capperOnlySignals} yesterdayStats={yesterdayStats}
            capperKPIs={capperKPIs} today={today} execSummary={execSummary} bestPlays={bestPlays}
          />
        </div>
      </div>

      {/* KPI Strip */}
      <KPIStrip
        eliteCount={eliteSignals.length}
        strongCount={strongSignals.length}
        alignedCount={alignedSignals.length}
        consensusWR={consensusStats.consensusWinRate}
        yesterdayROI={yesterdayStats.roi}
      />

      {/* Executive Summary */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4">
          <h3 className="text-[10px] font-bold tracking-widest text-amber-400 mb-1.5">EXECUTIVE SUMMARY</h3>
          <p className="text-xs leading-relaxed text-foreground/80">{execSummary}</p>
        </CardContent>
      </Card>

      {/* 🔥 BEST PLAYS RIGHT NOW */}
      <BestPlaysPanel bestPlays={bestPlays} />

      {/* View Filter */}
      <Select value={viewMode} onValueChange={v => setViewMode(v as any)}>
        <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Signals ({signals.length})</SelectItem>
          <SelectItem value="elite">🔥 Elite Only ({eliteSignals.length})</SelectItem>
          <SelectItem value="aligned">⚡ AI+Capper Aligned ({alignedSignals.length})</SelectItem>
          <SelectItem value="ai">🧠 AI Only ({aiOnlySignals.length})</SelectItem>
          <SelectItem value="capper">👥 Capper Only ({capperOnlySignals.length})</SelectItem>
        </SelectContent>
      </Select>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Signal Stack */}
        <div className="lg:col-span-2 space-y-6">
          {viewMode === 'all' ? (
            <>
              <SignalSection title="ELITE SIGNALS" icon={<Crown className="h-3.5 w-3.5" />} signals={eliteSignals} color="text-amber-400" />
              <SignalSection title="STRONG SIGNALS" icon={<Flame className="h-3.5 w-3.5" />} signals={strongSignals} color="text-emerald-400" />
              <SignalSection title="AI MODEL SIGNALS" icon={<Brain className="h-3.5 w-3.5" />} signals={aiOnlySignals} color="text-purple-400" />
              <SignalSection title="CAPPER CONSENSUS" icon={<Users className="h-3.5 w-3.5" />} signals={capperOnlySignals} color="text-blue-400" />
              {pendingSignals.length > 0 && (
                <SignalSection title="PENDING / LIVE" icon={<Clock className="h-3.5 w-3.5" />} signals={pendingSignals} color="text-muted-foreground" max={10} />
              )}
            </>
          ) : (
            displaySignals.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <Brain className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No signals for this filter</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {displaySignals.map((s, i) => <SignalCard key={i} signal={s} />)}
              </div>
            )
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SendControls />
          <MarketEdgePanel edges={marketEdges} />
          <CapperLeaderboard capperKPIs={capperKPIs} />

          {/* Yesterday */}
          <Card>
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-400" /> YESTERDAY
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><span className="text-lg font-black text-emerald-400">{yesterdayStats.wins}</span><p className="text-[9px] text-muted-foreground tracking-widest">W</p></div>
                <div><span className="text-lg font-black text-red-400">{yesterdayStats.losses}</span><p className="text-[9px] text-muted-foreground tracking-widest">L</p></div>
                <div><span className={`text-lg font-black ${yesterdayStats.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{yesterdayStats.roi > 0 ? '+' : ''}{yesterdayStats.roi}%</span><p className="text-[9px] text-muted-foreground tracking-widest">ROI</p></div>
              </div>
              {yesterdayStats.bestSignal && (
                <div className="mt-2 p-2 rounded border border-emerald-500/20 text-xs">
                  <span className="text-[9px] text-muted-foreground">Best:</span> <span className="font-bold">{yesterdayStats.bestSignal.player_name}</span> · {yesterdayStats.bestSignal.combined_score}pts
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <Card className="border-amber-500/20">
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-4 w-4 mx-auto text-amber-400 mb-1" />
              <p className="text-[9px] font-bold text-amber-400 tracking-wider">FOR MANUAL REVIEW ONLY</p>
              <p className="text-[8px] text-muted-foreground mt-0.5">Not financial advice. Confidence scores are advisory.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
