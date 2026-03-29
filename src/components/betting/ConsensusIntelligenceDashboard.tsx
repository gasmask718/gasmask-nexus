import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, TrendingUp, Users, Target, Trophy, Flame, AlertTriangle, DollarSign } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useConsensusIntelligence, CapperKPI, ConsensusPick } from '@/hooks/useConsensusIntelligence';

const sportColors: Record<string, string> = {
  NBA: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
  NFL: 'text-green-500 border-green-500/30 bg-green-500/10',
  MLB: 'text-red-500 border-red-500/30 bg-red-500/10',
  NHL: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
};

type FilterMode = 'all' | 'consensus_only' | 'high_roi' | 'best_markets';

export function ConsensusIntelligenceDashboard() {
  const { consensusPicks, consensusStats, capperKPIs, todayConsensusPicks, isLoading } = useConsensusIntelligence();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const filteredCappers = useMemo(() => {
    switch (filterMode) {
      case 'high_roi': return capperKPIs.filter(c => c.roi > 0 && c.totalPicks >= 3);
      case 'consensus_only': return capperKPIs.filter(c => c.consensusHitRate > 0);
      case 'best_markets': return [...capperKPIs].sort((a, b) => b.winRate - a.winRate).filter(c => c.totalPicks >= 3);
      default: return capperKPIs;
    }
  }, [capperKPIs, filterMode]);

  if (isLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Consensus KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card className="border-amber-500/20"><CardContent className="p-3 text-center">
          <Flame className="h-4 w-4 mx-auto text-amber-400 mb-1" />
          <p className="text-xl font-black text-amber-400">{consensusStats.totalConsensusPicks}</p>
          <p className="text-[10px] text-muted-foreground">Consensus Picks</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Target className="h-4 w-4 mx-auto text-emerald-400 mb-1" />
          <p className={`text-xl font-black ${consensusStats.consensusWinRate >= 55 ? 'text-emerald-400' : ''}`}>{consensusStats.consensusWinRate}%</p>
          <p className="text-[10px] text-muted-foreground">Consensus Win Rate</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <TrendingUp className="h-4 w-4 mx-auto text-blue-400 mb-1" />
          <p className={`text-xl font-black ${consensusStats.consensusROI > 0 ? 'text-emerald-400' : 'text-destructive'}`}>{consensusStats.consensusROI > 0 ? '+' : ''}{consensusStats.consensusROI}%</p>
          <p className="text-[10px] text-muted-foreground">Consensus ROI</p>
        </CardContent></Card>
        <Card className="border-orange-500/20"><CardContent className="p-3 text-center">
          <p className={`text-xl font-black ${consensusStats.highConsensusWinRate >= 55 ? 'text-emerald-400' : ''}`}>{consensusStats.highConsensusWinRate}%</p>
          <p className="text-[10px] text-muted-foreground">High Consensus WR (4+)</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className={`text-xl font-black ${consensusStats.mediumConsensusWinRate >= 55 ? 'text-emerald-400' : ''}`}>{consensusStats.mediumConsensusWinRate}%</p>
          <p className="text-[10px] text-muted-foreground">Medium Consensus WR</p>
        </CardContent></Card>
      </div>

      {/* 🔥 Top Consensus Picks Today */}
      {todayConsensusPicks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" /> Top Consensus Picks Today
            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">{todayConsensusPicks.length} picks</Badge>
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {todayConsensusPicks.slice(0, 6).map((pick, i) => (
              <ConsensusPickCard key={i} pick={pick} />
            ))}
          </div>
        </div>
      )}

      {/* Smart Filter */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" /> Capper KPIs
        </h3>
        <Select value={filterMode} onValueChange={v => setFilterMode(v as FilterMode)}>
          <SelectTrigger className="w-44 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cappers</SelectItem>
            <SelectItem value="consensus_only">🔥 Consensus Only</SelectItem>
            <SelectItem value="high_roi">💰 High ROI</SelectItem>
            <SelectItem value="best_markets">🎯 Best Win Rate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Capper KPI Table */}
      <div className="space-y-1.5">
        {filteredCappers.length === 0 ? (
          <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">No cappers match this filter</CardContent></Card>
        ) : filteredCappers.map(c => (
          <CapperKPICard key={c.id} capper={c} />
        ))}
      </div>

      {/* All Consensus Picks (recent) */}
      {consensusPicks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" /> All Consensus Picks
            <Badge variant="outline" className="text-[10px]">{consensusPicks.length} total</Badge>
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {consensusPicks.slice(0, 12).map((pick, i) => (
              <ConsensusPickCard key={i} pick={pick} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConsensusPickCard({ pick, compact }: { pick: ConsensusPick; compact?: boolean }) {
  return (
    <Card className={`overflow-hidden ${
      pick.confidenceLevel === 'high' ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent' :
      pick.confidenceLevel === 'medium' ? 'border-blue-500/20' : ''
    }`}>
      <CardContent className={compact ? 'p-2.5' : 'p-3'}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`font-bold ${compact ? 'text-sm' : 'text-base'}`}>{pick.player_name}</span>
              <Badge className={`text-[9px] ${sportColors[pick.sport] || ''}`}>{pick.sport}</Badge>
              {pick.confidenceLevel === 'high' && (
                <Badge variant="outline" className="text-[8px] text-amber-400 border-amber-400/30 bg-amber-400/10">🔥 High Consensus</Badge>
              )}
              {pick.result && (
                <Badge variant={pick.result === 'won' ? 'default' : 'destructive'} className="text-[8px]">
                  {pick.result === 'won' ? '✅' : '❌'} {pick.result}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${
                pick.direction === 'OVER' ? 'text-emerald-500 border-emerald-500/30' : 'text-blue-500 border-blue-500/30'
              }`}>{pick.direction}</Badge>
              <Badge variant="outline" className="text-[10px]">{pick.prop_type}</Badge>
              <span className="text-xs font-medium">{pick.line}</span>
              {pick.team && <span className="text-[10px] text-muted-foreground">· {pick.team}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span>📅 {pick.game_date}</span>
              <span>· 👥 {pick.capperNames.join(', ')}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-black text-amber-400">{pick.capperCount}</p>
            <p className="text-[9px] text-muted-foreground">cappers</p>
            {pick.avgCapperROI !== 0 && (
              <p className={`text-[10px] font-bold ${pick.avgCapperROI > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                {pick.avgCapperROI > 0 ? '+' : ''}{pick.avgCapperROI}% ROI
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CapperKPICard({ capper }: { capper: CapperKPI }) {
  return (
    <Card className={`overflow-hidden ${
      capper.badge === 'high_roi' ? 'border-emerald-500/20' : 
      capper.badge === 'low_accuracy' ? 'border-destructive/20' : ''
    }`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm">{capper.name}</span>
              <Badge variant="outline" className="text-[9px]">{capper.tier}</Badge>
              {capper.badge === 'high_roi' && (
                <Badge variant="outline" className="text-[8px] text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                  <DollarSign className="h-2.5 w-2.5 mr-0.5" /> High ROI
                </Badge>
              )}
              {capper.badge === 'low_accuracy' && (
                <Badge variant="outline" className="text-[8px] text-destructive border-destructive/30 bg-destructive/10">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Low Accuracy
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-center shrink-0">
            <div>
              <p className={`text-sm font-bold ${capper.roi > 0 ? 'text-emerald-400' : capper.roi < 0 ? 'text-destructive' : ''}`}>
                {capper.roi > 0 ? '+' : ''}{capper.roi}%
              </p>
              <p className="text-[9px] text-muted-foreground">ROI</p>
            </div>
            <div>
              <p className={`text-sm font-bold ${capper.winRate >= 55 ? 'text-emerald-400' : ''}`}>{capper.winRate}%</p>
              <p className="text-[9px] text-muted-foreground">Win Rate</p>
            </div>
            <div>
              <p className="text-sm font-bold">{capper.totalPicks}</p>
              <p className="text-[9px] text-muted-foreground">Picks</p>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-400">{capper.consensusHitRate}%</p>
              <p className="text-[9px] text-muted-foreground">Consensus</p>
            </div>
            <div>
              <p className="text-sm font-bold">{capper.bestMarket}</p>
              <p className="text-[9px] text-muted-foreground">Best Mkt</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
