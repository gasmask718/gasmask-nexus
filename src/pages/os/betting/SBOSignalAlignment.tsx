import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Wallet, Users, Zap, Shield, AlertTriangle } from 'lucide-react';

interface AlignedSignal {
  key: string;
  playerOrMarket: string;
  propType?: string;
  direction?: string;
  aiConfidence?: number;
  walletMatch: boolean;
  walletTier?: string;
  capperMatch: boolean;
  capperName?: string;
  capperTier?: string;
  alignmentScore: number;
  sources: string[];
}

export default function SBOSignalAlignment() {
  const today = new Date().toISOString().split('T')[0];

  const { data: predictions = [] } = useQuery({
    queryKey: ['signal-predictions', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('sbo_predictions')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .order('confidence_score', { ascending: false });
      return data || [];
    },
  });

  const { data: walletActivity = [] } = useQuery({
    queryKey: ['signal-wallet-activity'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_wallet_activity')
        .select('*, sbo_tracked_wallets(label, tier)')
        .gte('detected_at', `${today}T00:00:00`)
        .eq('result', 'pending');
      return data || [];
    },
  });

  const { data: capperPicks = [] } = useQuery({
    queryKey: ['signal-capper-picks'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_capper_picks')
        .select('*, sbo_cappers(name, tier)')
        .eq('game_date', today)
        .eq('result', 'pending');
      return data || [];
    },
  });

  const signals = useMemo<AlignedSignal[]>(() => {
    if (!predictions.length) return [];

    return predictions.map((pred: any) => {
      const playerLower = (pred.player_name || '').toLowerCase();
      const teamLower = (pred.home_team || '').toLowerCase();
      const propLower = (pred.prop_type || '').toLowerCase();

      // Match wallet activity by market text
      const walletHit = walletActivity.find((w: any) => {
        const marketLower = (w.market || '').toLowerCase();
        return marketLower.includes(playerLower) || marketLower.includes(teamLower);
      });

      // Match capper picks
      const capperHit = capperPicks.find((c: any) => {
        const pickLower = (c.player_name || c.pick_text || '').toLowerCase();
        return pickLower.includes(playerLower) || (playerLower && pickLower.includes(playerLower));
      });

      const sources: string[] = ['AI'];
      if (walletHit) sources.push('Wallet');
      if (capperHit) sources.push('Capper');

      let alignmentScore = pred.confidence_score || 50;
      if (walletHit) {
        alignmentScore += walletHit.sbo_tracked_wallets?.tier === 'elite' ? 10 : 5;
      }
      if (capperHit) {
        alignmentScore += capperHit.sbo_cappers?.tier === 'elite' ? 8 : 3;
      }
      alignmentScore = Math.min(alignmentScore, 99);

      return {
        key: pred.id,
        playerOrMarket: pred.player_name || `${pred.home_team} vs ${pred.away_team}`,
        propType: pred.prop_type || pred.market_type,
        direction: pred.pick_direction,
        aiConfidence: pred.confidence_score,
        walletMatch: !!walletHit,
        walletTier: walletHit?.sbo_tracked_wallets?.tier,
        capperMatch: !!capperHit,
        capperName: capperHit?.sbo_cappers?.name,
        capperTier: capperHit?.sbo_cappers?.tier,
        alignmentScore,
        sources,
      };
    }).sort((a: AlignedSignal, b: AlignedSignal) => b.sources.length - a.sources.length || b.alignmentScore - a.alignmentScore);
  }, [predictions, walletActivity, capperPicks]);

  const tripleAligned = signals.filter(s => s.sources.length === 3);
  const doubleAligned = signals.filter(s => s.sources.length === 2);

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-amber-500" />
        <div>
          <h1 className="text-xl font-bold">Signal Alignment</h1>
          <p className="text-xs text-muted-foreground">Cross-reference AI + Wallets + Cappers</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{predictions.length}</p><p className="text-[10px] text-muted-foreground">AI Predictions</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{walletActivity.length}</p><p className="text-[10px] text-muted-foreground">Wallet Moves</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{capperPicks.length}</p><p className="text-[10px] text-muted-foreground">Capper Picks</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-500">{tripleAligned.length}</p><p className="text-[10px] text-muted-foreground">Triple Aligned 🔥</p></CardContent></Card>
      </div>

      {/* Triple alignment alert */}
      {tripleAligned.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              🔥 Triple Alignment — AI + Wallet + Capper Agree
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tripleAligned.map(s => (
              <SignalCard key={s.key} signal={s} highlight />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Double alignment */}
      {doubleAligned.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              Double Alignment — 2 Sources Agree
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {doubleAligned.map(s => (
              <SignalCard key={s.key} signal={s} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* All signals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">All Today's Signals ({signals.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Run AI predictions and log wallet/capper activity to see alignment.</p>
          ) : signals.map(s => (
            <SignalCard key={s.key} signal={s} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SignalCard({ signal, highlight }: { signal: AlignedSignal; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${highlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-muted/30'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{signal.playerOrMarket}</span>
          {signal.propType && <Badge variant="outline" className="text-[10px]">{signal.propType}</Badge>}
          {signal.direction && <Badge variant="outline" className="text-[10px]">{signal.direction}</Badge>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {signal.sources.map(src => {
            const icon = src === 'AI' ? <Brain className="h-3 w-3" /> : src === 'Wallet' ? <Wallet className="h-3 w-3" /> : <Users className="h-3 w-3" />;
            const color = src === 'AI' ? 'text-blue-500' : src === 'Wallet' ? 'text-emerald-500' : 'text-purple-500';
            return (
              <span key={src} className={`flex items-center gap-0.5 text-[10px] ${color}`}>
                {icon} {src}
              </span>
            );
          })}
          {signal.walletTier && <Badge variant="outline" className="text-[9px]">🟢 {signal.walletTier} wallet</Badge>}
          {signal.capperName && <Badge variant="outline" className="text-[9px]">🔵 {signal.capperName}</Badge>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <Badge className={`text-[10px] ${signal.sources.length >= 3 ? 'bg-amber-500' : signal.sources.length >= 2 ? 'bg-emerald-500' : ''}`}>
          {signal.alignmentScore}%
        </Badge>
        <p className="text-[9px] text-muted-foreground mt-0.5">{signal.sources.length} source{signal.sources.length > 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}
