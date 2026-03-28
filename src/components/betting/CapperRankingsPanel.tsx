import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Trophy, TrendingUp, TrendingDown, RefreshCw, Crown, Flame, Snowflake, AlertTriangle, DollarSign, Target } from 'lucide-react';
import { toast } from 'sonner';

interface CapperRanking {
  id: string;
  name: string;
  telegram_username: string | null;
  win_rate: number | null;
  total_picks: number | null;
  grade: string | null;
  capper_weight: number | null;
  hot_streak: number | null;
  cold_streak: number | null;
  best_market: string | null;
  best_sport: string | null;
  status: string | null;
  roi_breakdown: Array<{
    sport: string;
    market_type: string;
    wins: number;
    losses: number;
    pushes: number;
    total_bets: number;
    win_rate: number;
    roi_percentage: number;
    total_profit: number;
  }>;
  badges: string[];
}

const gradeColors: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  D: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function CapperRankingsPanel() {
  const [selectedCapper, setSelectedCapper] = useState<string | null>(null);

  const { data: rankings, isLoading, refetch } = useQuery({
    queryKey: ['capper-rankings'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sbo-external-results', {
        body: { mode: 'capper_rankings' },
      });
      if (error) throw error;
      return (data as { rankings: CapperRanking[] }).rankings;
    },
  });

  const selected = rankings?.find(c => c.id === selectedCapper);
  const totalROI = selected?.roi_breakdown?.reduce((sum, r) => sum + (r.total_profit || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-amber-500" />
          <div>
            <h2 className="text-xl font-bold">Capper Rankings & ROI</h2>
            <p className="text-xs text-muted-foreground">Auto-graded performance · Data-driven intelligence</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Rankings Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Leaderboard</CardTitle>
          <CardDescription>Click a capper to see detailed ROI breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading rankings...</div>
          ) : !rankings?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No graded cappers yet. Resolve picks to generate rankings.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3">#</th>
                    <th className="pb-2 pr-3">Capper</th>
                    <th className="pb-2 pr-3">Grade</th>
                    <th className="pb-2 pr-3">Win Rate</th>
                    <th className="pb-2 pr-3">Picks</th>
                    <th className="pb-2 pr-3">Weight</th>
                    <th className="pb-2 pr-3">Streak</th>
                    <th className="pb-2 pr-3">Best Market</th>
                    <th className="pb-2">Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rankings.map((c, i) => (
                    <tr
                      key={c.id}
                      className={`text-xs cursor-pointer transition-colors hover:bg-muted/50 ${selectedCapper === c.id ? 'bg-muted/30' : ''}`}
                      onClick={() => setSelectedCapper(c.id === selectedCapper ? null : c.id)}
                    >
                      <td className="py-2.5 pr-3 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <div>
                          <span className="font-medium">{c.name}</span>
                          {c.telegram_username && (
                            <span className="text-muted-foreground ml-1">@{c.telegram_username}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${gradeColors[c.grade || 'C']}`}>
                          {c.grade || 'C'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono font-medium">
                        {c.win_rate != null ? `${c.win_rate}%` : '—'}
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{c.total_picks ?? 0}</td>
                      <td className="py-2.5 pr-3 font-mono">{c.capper_weight?.toFixed(2) ?? '1.00'}</td>
                      <td className="py-2.5 pr-3">
                        {(c.hot_streak ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <TrendingUp className="h-3 w-3" /> {c.hot_streak}W
                          </span>
                        )}
                        {(c.cold_streak ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-red-400">
                            <TrendingDown className="h-3 w-3" /> {c.cold_streak}L
                          </span>
                        )}
                        {!(c.hot_streak ?? 0) && !(c.cold_streak ?? 0) && '—'}
                      </td>
                      <td className="py-2.5 pr-3 capitalize">{c.best_market?.replace(/_/g, ' ') || '—'}</td>
                      <td className="py-2.5">
                        <div className="flex gap-1 flex-wrap">
                          {c.badges.map((b, bi) => (
                            <span key={bi} className="text-xs">{b}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Capper Detail */}
      {selected && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {selected.name} — ROI Breakdown
            </CardTitle>
            <CardDescription>
              Grade: <span className={`font-bold ${selected.grade === 'A' ? 'text-emerald-400' : selected.grade === 'B' ? 'text-blue-400' : selected.grade === 'D' ? 'text-red-400' : 'text-amber-400'}`}>{selected.grade}</span>
              {' · '}Weight: {selected.capper_weight?.toFixed(2)}
              {' · '}Total P/L: <span className={totalROI >= 0 ? 'text-emerald-400' : 'text-red-400'}>{totalROI >= 0 ? '+' : ''}{totalROI.toFixed(2)}u</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selected.roi_breakdown?.length ? (
              <p className="text-sm text-muted-foreground">No ROI data yet for this capper.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="pb-2 pr-3">Market</th>
                      <th className="pb-2 pr-3">W</th>
                      <th className="pb-2 pr-3">L</th>
                      <th className="pb-2 pr-3">P</th>
                      <th className="pb-2 pr-3">Total</th>
                      <th className="pb-2 pr-3">Win %</th>
                      <th className="pb-2 pr-3">ROI</th>
                      <th className="pb-2">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selected.roi_breakdown.map((r, i) => (
                      <tr key={i} className="text-xs">
                        <td className="py-2 pr-3 capitalize font-medium">{r.market_type.replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-3 text-emerald-400 font-mono">{r.wins}</td>
                        <td className="py-2 pr-3 text-red-400 font-mono">{r.losses}</td>
                        <td className="py-2 pr-3 text-muted-foreground font-mono">{r.pushes}</td>
                        <td className="py-2 pr-3 font-mono">{r.total_bets}</td>
                        <td className="py-2 pr-3 font-mono font-medium">{r.win_rate}%</td>
                        <td className={`py-2 pr-3 font-mono font-bold ${r.roi_percentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.roi_percentage >= 0 ? '+' : ''}{r.roi_percentage}%
                        </td>
                        <td className={`py-2 font-mono ${r.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.total_profit >= 0 ? '+' : ''}{r.total_profit.toFixed(2)}u
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
