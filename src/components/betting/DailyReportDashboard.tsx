import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Flame, TrendingUp, Target, Users, Trophy, Brain, Eye, Send, Mail, Clock,
  CheckCircle, XCircle, AlertTriangle, BarChart3, Crown, Zap, Loader2
} from 'lucide-react';
import { useUnifiedSignals, UnifiedSignal } from '@/hooks/useUnifiedSignals';
import { CapperKPI } from '@/hooks/useConsensusIntelligence';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const sportColors: Record<string, string> = {
  NBA: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
  NFL: 'text-green-500 border-green-500/30 bg-green-500/10',
  MLB: 'text-red-500 border-red-500/30 bg-red-500/10',
  NHL: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
};

const tierConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  ELITE: { color: 'text-amber-400 border-amber-400/30 bg-amber-400/10', icon: <Crown className="h-3 w-3" />, label: 'ELITE' },
  STRONG: { color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10', icon: <Flame className="h-3 w-3" />, label: 'STRONG' },
  WATCHLIST: { color: 'text-blue-400 border-blue-400/30 bg-blue-400/10', icon: <Eye className="h-3 w-3" />, label: 'WATCHLIST' },
  LOW: { color: 'text-muted-foreground border-border bg-muted/30', icon: <AlertTriangle className="h-3 w-3" />, label: 'LOW' },
};

// ── Signal Row Component ──
function SignalRow({ signal }: { signal: UnifiedSignal }) {
  const tier = tierConfig[signal.signal_tier] || tierConfig.LOW;
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${
      signal.signal_tier === 'ELITE' ? 'border-amber-500/30 bg-amber-500/5' :
      signal.signal_tier === 'STRONG' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border'
    }`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-sm">{signal.player_name}</span>
          <Badge className={`text-[9px] ${sportColors[signal.sport] || ''}`}>{signal.sport}</Badge>
          <Badge variant="outline" className={`text-[9px] gap-0.5 ${tier.color}`}>
            {tier.icon} {tier.label}
          </Badge>
          {signal.result && (
            <Badge variant={signal.result === 'won' ? 'default' : 'destructive'} className="text-[8px]">
              {signal.result === 'won' ? '✅' : '❌'} {signal.result}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Badge variant="outline" className={`text-[10px] ${
            signal.direction === 'OVER' ? 'text-emerald-500 border-emerald-500/30' : 'text-blue-500 border-blue-500/30'
          }`}>{signal.direction}</Badge>
          <Badge variant="outline" className="text-[10px]">{signal.prop_type}</Badge>
          <span className="text-xs font-bold">{signal.line}</span>
          {signal.team && <span className="text-[10px] text-muted-foreground">· {signal.team}</span>}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
          {signal.ai_confidence != null && (
            <span>🧠 AI: <span className="font-medium">{signal.ai_confidence}%</span></span>
          )}
          {signal.capper_consensus > 0 && (
            <span>👥 {signal.capper_consensus} cappers{signal.capper_names.length > 0 ? `: ${signal.capper_names.slice(0, 3).join(', ')}` : ''}</span>
          )}
          {signal.capper_avg_roi !== 0 && (
            <span className={signal.capper_avg_roi > 0 ? 'text-emerald-400' : 'text-destructive'}>
              ROI: {signal.capper_avg_roi > 0 ? '+' : ''}{signal.capper_avg_roi}%
            </span>
          )}
        </div>
      </div>
      <div className="text-center shrink-0">
        <p className={`text-2xl font-black ${
          signal.combined_score >= 75 ? 'text-amber-400' :
          signal.combined_score >= 55 ? 'text-emerald-400' :
          signal.combined_score >= 35 ? 'text-blue-400' : 'text-muted-foreground'
        }`}>{signal.combined_score}</p>
        <p className="text-[9px] text-muted-foreground">score</p>
      </div>
    </div>
  );
}

// ── Email Preview Dialog ──
function EmailPreviewDialog({ signals, aligned, aiOnly, capperOnly, yesterdayStats, capperKPIs, consensusStats, today }: any) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <Eye className="h-4 w-4" /> Preview Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📩 Daily Intelligence Brief Preview</DialogTitle>
        </DialogHeader>
        <div className="border rounded-lg p-6 bg-background space-y-6 text-sm">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h1 className="text-xl font-black">🧠 SBO DAILY INTELLIGENCE BRIEF</h1>
            <p className="text-muted-foreground text-xs mt-1">{today} · For Manual Review Only</p>
          </div>

          {/* Executive Summary */}
          <div className="space-y-2">
            <h2 className="font-bold text-base flex items-center gap-2">📊 Executive Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded border text-center">
                <p className="text-lg font-black text-amber-400">{signals.length}</p>
                <p className="text-[10px] text-muted-foreground">Total Signals</p>
              </div>
              <div className="p-2 rounded border text-center">
                <p className="text-lg font-black text-emerald-400">{aligned.length}</p>
                <p className="text-[10px] text-muted-foreground">AI+Capper Aligned</p>
              </div>
              <div className="p-2 rounded border text-center">
                <p className="text-lg font-black">{signals.filter((s: UnifiedSignal) => s.signal_tier === 'ELITE').length}</p>
                <p className="text-[10px] text-muted-foreground">Elite Signals</p>
              </div>
              <div className="p-2 rounded border text-center">
                <p className={`text-lg font-black ${yesterdayStats.roi > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                  {yesterdayStats.roi > 0 ? '+' : ''}{yesterdayStats.roi}%
                </p>
                <p className="text-[10px] text-muted-foreground">Yesterday ROI</p>
              </div>
            </div>
          </div>

          {/* Aligned Picks */}
          {aligned.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-bold text-base flex items-center gap-2">🔥 AI + Capper Aligned Picks</h2>
              {aligned.slice(0, 5).map((s: UnifiedSignal, i: number) => (
                <div key={i} className="p-2 rounded border text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold">{s.player_name}</span>
                    <span className="text-muted-foreground ml-2">{s.direction} {s.line} {s.prop_type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span>🧠 {s.ai_confidence}%</span>
                    <span>👥 {s.capper_consensus}</span>
                    <Badge variant="outline" className={`text-[9px] ${tierConfig[s.signal_tier]?.color}`}>{s.signal_tier}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Only */}
          {aiOnly.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-bold text-base flex items-center gap-2">🧠 AI Only Signals</h2>
              {aiOnly.slice(0, 5).map((s: UnifiedSignal, i: number) => (
                <div key={i} className="p-2 rounded border text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold">{s.player_name}</span>
                    <span className="text-muted-foreground ml-2">{s.direction} {s.line} {s.prop_type}</span>
                  </div>
                  <span>🧠 {s.ai_confidence}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Capper Only */}
          {capperOnly.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-bold text-base flex items-center gap-2">👥 Capper Consensus Only</h2>
              {capperOnly.slice(0, 5).map((s: UnifiedSignal, i: number) => (
                <div key={i} className="p-2 rounded border text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold">{s.player_name}</span>
                    <span className="text-muted-foreground ml-2">{s.direction} {s.line} {s.prop_type}</span>
                  </div>
                  <span>👥 {s.capper_consensus} cappers · ROI: {s.capper_avg_roi > 0 ? '+' : ''}{s.capper_avg_roi}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Top Cappers */}
          <div className="space-y-2">
            <h2 className="font-bold text-base flex items-center gap-2">🏆 Top Cappers</h2>
            <div className="space-y-1">
              {capperKPIs.filter((c: CapperKPI) => c.totalPicks >= 3).slice(0, 5).map((c: CapperKPI) => (
                <div key={c.id} className="p-2 rounded border text-xs flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  <div className="flex items-center gap-3">
                    <span className={c.roi > 0 ? 'text-emerald-400' : 'text-destructive'}>{c.roi > 0 ? '+' : ''}{c.roi}% ROI</span>
                    <span>{c.winRate}% WR</span>
                    <span className="text-muted-foreground">{c.totalPicks}p</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yesterday Results */}
          <div className="space-y-2">
            <h2 className="font-bold text-base flex items-center gap-2">📈 Yesterday Results</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded border text-center">
                <p className="text-lg font-black text-emerald-400">{yesterdayStats.wins}</p>
                <p className="text-[10px] text-muted-foreground">Wins</p>
              </div>
              <div className="p-2 rounded border text-center">
                <p className="text-lg font-black text-destructive">{yesterdayStats.losses}</p>
                <p className="text-[10px] text-muted-foreground">Losses</p>
              </div>
              <div className="p-2 rounded border text-center">
                <p className={`text-lg font-black ${yesterdayStats.roi > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                  {yesterdayStats.roi > 0 ? '+' : ''}{yesterdayStats.roi}%
                </p>
                <p className="text-[10px] text-muted-foreground">ROI</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center border-t pt-4">
            <p className="text-[10px] text-muted-foreground">⚠️ FOR MANUAL REVIEW ONLY — Do not auto-place bets</p>
            <p className="text-[10px] text-muted-foreground">Generated by SBO AI Engine · Confidence scores are advisory only</p>
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
      if (!user?.email) { toast.error('No email found for current user'); return; }
      toast.success(`Test report would be sent to ${user.email}`);
      // In production this would invoke an edge function to send the report
    } catch (err) {
      toast.error('Failed to send test email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-400" /> Report Delivery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={sendTestEmail} disabled={sending} className="gap-1.5" size="sm">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Send Test Email
          </Button>
        </div>

        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium flex items-center gap-2">
              <Clock className="h-3 w-3" /> Daily Schedule
            </Label>
            <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
          </div>
          {scheduleEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Send Time</Label>
                <Input type="time" value={sendTime} onChange={e => setSendTime(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern</SelectItem>
                    <SelectItem value="America/Chicago">Central</SelectItem>
                    <SelectItem value="America/Denver">Mountain</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-3 space-y-2">
          <Label className="text-xs font-medium flex items-center gap-2">
            <Users className="h-3 w-3" /> Recipient Groups
          </Label>
          <div className="space-y-1.5">
            {['Owner', 'Betting Ops', 'Review Team'].map(group => (
              <div key={group} className="flex items-center justify-between p-2 rounded border text-xs">
                <span className="font-medium">{group}</span>
                <Switch defaultChecked={group === 'Owner'} />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ──
export function DailyReportDashboard() {
  const {
    signals, alignedSignals, aiOnlySignals, capperOnlySignals, pendingSignals,
    yesterdayStats, consensusStats, capperKPIs, isLoading, today
  } = useUnifiedSignals();
  const [viewMode, setViewMode] = useState<'all' | 'aligned' | 'ai' | 'capper'>('all');

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>;
  }

  const activeSignals = viewMode === 'aligned' ? alignedSignals :
    viewMode === 'ai' ? aiOnlySignals :
    viewMode === 'capper' ? capperOnlySignals : signals;

  const eliteCount = signals.filter(s => s.signal_tier === 'ELITE').length;
  const strongCount = signals.filter(s => s.signal_tier === 'STRONG').length;

  return (
    <div className="space-y-4">
      {/* Executive KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card className="border-amber-500/20"><CardContent className="p-3 text-center">
          <Crown className="h-4 w-4 mx-auto text-amber-400 mb-1" />
          <p className="text-xl font-black text-amber-400">{eliteCount}</p>
          <p className="text-[10px] text-muted-foreground">Elite Signals</p>
        </CardContent></Card>
        <Card className="border-emerald-500/20"><CardContent className="p-3 text-center">
          <Flame className="h-4 w-4 mx-auto text-emerald-400 mb-1" />
          <p className="text-xl font-black text-emerald-400">{strongCount}</p>
          <p className="text-[10px] text-muted-foreground">Strong Signals</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Zap className="h-4 w-4 mx-auto text-purple-400 mb-1" />
          <p className="text-xl font-black text-purple-400">{alignedSignals.length}</p>
          <p className="text-[10px] text-muted-foreground">AI+Capper Aligned</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Target className="h-4 w-4 mx-auto text-blue-400 mb-1" />
          <p className={`text-xl font-black ${consensusStats.consensusWinRate >= 55 ? 'text-emerald-400' : ''}`}>
            {consensusStats.consensusWinRate}%
          </p>
          <p className="text-[10px] text-muted-foreground">Consensus WR</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <TrendingUp className="h-4 w-4 mx-auto text-emerald-400 mb-1" />
          <p className={`text-xl font-black ${yesterdayStats.roi > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
            {yesterdayStats.roi > 0 ? '+' : ''}{yesterdayStats.roi}%
          </p>
          <p className="text-[10px] text-muted-foreground">Yesterday ROI</p>
        </CardContent></Card>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={viewMode} onValueChange={v => setViewMode(v as any)}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📊 All Signals ({signals.length})</SelectItem>
              <SelectItem value="aligned">🔥 AI+Capper Aligned ({alignedSignals.length})</SelectItem>
              <SelectItem value="ai">🧠 AI Only ({aiOnlySignals.length})</SelectItem>
              <SelectItem value="capper">👥 Capper Only ({capperOnlySignals.length})</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-[10px]">{today}</Badge>
        </div>
        <div className="flex gap-2">
          <EmailPreviewDialog
            signals={signals}
            aligned={alignedSignals}
            aiOnly={aiOnlySignals}
            capperOnly={capperOnlySignals}
            yesterdayStats={yesterdayStats}
            capperKPIs={capperKPIs}
            consensusStats={consensusStats}
            today={today}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main Signal List */}
        <div className="lg:col-span-2 space-y-2">
          {activeSignals.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-8 text-center">
              <Brain className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No signals for this filter</p>
            </CardContent></Card>
          ) : (
            <>
              {/* Aligned Section */}
              {(viewMode === 'all' || viewMode === 'aligned') && alignedSignals.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
                    <Zap className="h-3 w-3" /> AI + CAPPER ALIGNED
                    <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-400/30">{alignedSignals.length}</Badge>
                  </h3>
                  {alignedSignals.slice(0, viewMode === 'aligned' ? 20 : 5).map((s, i) => (
                    <SignalRow key={`aligned-${i}`} signal={s} />
                  ))}
                </div>
              )}

              {/* AI Only Section */}
              {(viewMode === 'all' || viewMode === 'ai') && aiOnlySignals.length > 0 && (
                <div className="space-y-1.5 mt-4">
                  <h3 className="text-xs font-bold flex items-center gap-1.5 text-purple-400">
                    <Brain className="h-3 w-3" /> AI ONLY SIGNALS
                    <Badge variant="outline" className="text-[9px]">{aiOnlySignals.length}</Badge>
                  </h3>
                  {aiOnlySignals.slice(0, viewMode === 'ai' ? 20 : 5).map((s, i) => (
                    <SignalRow key={`ai-${i}`} signal={s} />
                  ))}
                </div>
              )}

              {/* Capper Only Section */}
              {(viewMode === 'all' || viewMode === 'capper') && capperOnlySignals.length > 0 && (
                <div className="space-y-1.5 mt-4">
                  <h3 className="text-xs font-bold flex items-center gap-1.5 text-blue-400">
                    <Users className="h-3 w-3" /> CAPPER CONSENSUS ONLY
                    <Badge variant="outline" className="text-[9px]">{capperOnlySignals.length}</Badge>
                  </h3>
                  {capperOnlySignals.slice(0, viewMode === 'capper' ? 20 : 5).map((s, i) => (
                    <SignalRow key={`cap-${i}`} signal={s} />
                  ))}
                </div>
              )}

              {/* Pending / Live */}
              {viewMode === 'all' && pendingSignals.length > 0 && (
                <div className="space-y-1.5 mt-4">
                  <h3 className="text-xs font-bold flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3 w-3" /> PENDING / LIVE
                    <Badge variant="outline" className="text-[9px]">{pendingSignals.length}</Badge>
                  </h3>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Send Controls */}
          <SendControls />

          {/* Top Cappers Mini */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" /> Top Cappers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {capperKPIs.filter(c => c.totalPicks >= 3).slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded border text-xs">
                  <div className="flex items-center gap-1.5">
                    {c.badge === 'high_roi' && <span>💰</span>}
                    {c.badge === 'low_accuracy' && <span>⚠️</span>}
                    <span className="font-medium">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={c.roi > 0 ? 'text-emerald-400 font-bold' : 'text-destructive'}>
                      {c.roi > 0 ? '+' : ''}{c.roi}%
                    </span>
                    <span className="text-muted-foreground">{c.winRate}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Yesterday Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-400" /> Yesterday
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-black text-emerald-400">{yesterdayStats.wins}</p>
                  <p className="text-[9px] text-muted-foreground">Wins</p>
                </div>
                <div>
                  <p className="text-lg font-black text-destructive">{yesterdayStats.losses}</p>
                  <p className="text-[9px] text-muted-foreground">Losses</p>
                </div>
                <div>
                  <p className={`text-lg font-black ${yesterdayStats.roi > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                    {yesterdayStats.roi > 0 ? '+' : ''}{yesterdayStats.roi}%
                  </p>
                  <p className="text-[9px] text-muted-foreground">ROI</p>
                </div>
              </div>
              {yesterdayStats.bestSignal && (
                <div className="mt-2 p-2 rounded border border-emerald-500/20 text-xs">
                  <p className="text-[10px] text-muted-foreground">Best Signal</p>
                  <p className="font-bold">{yesterdayStats.bestSignal.player_name} · Score: {yesterdayStats.bestSignal.combined_score}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Safety Notice */}
          <Card className="border-amber-500/20">
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto text-amber-400 mb-1" />
              <p className="text-[10px] font-bold text-amber-400">FOR MANUAL REVIEW ONLY</p>
              <p className="text-[9px] text-muted-foreground mt-1">All picks labeled as advisory. Confidence scores are not guarantees.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
