import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, ArrowLeft, Flame, Infinity as InfinityIcon, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVALeaderboard } from '@/hooks/useBrandaroVAPerformance';

function BoardRow({ va, i }: { va: any; i: number }) {
  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-lg border ${
        i === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'bg-card'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`text-base font-bold w-6 text-center ${
            i === 0
              ? 'text-amber-400'
              : i === 1
              ? 'text-gray-400'
              : i === 2
              ? 'text-orange-700'
              : 'text-muted-foreground'
          }`}
        >
          #{i + 1}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{va.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {va.calls} calls · {va.closes} closes
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {i === 0 && <Trophy className="h-4 w-4 text-amber-400" />}
        <Badge variant="secondary">{va.score} pts</Badge>
      </div>
    </div>
  );
}

function ChampionCard({ va, label, accent }: { va?: any; label: string; accent: string }) {
  if (!va) {
    return (
      <Card className="border-dashed border-slate-800 bg-slate-900/40">
        <CardContent className="py-6 text-center text-sm text-slate-500">
          No {label.toLowerCase()} champion yet
        </CardContent>
      </Card>
    );
  }
  return (
    <Card
      className="overflow-hidden"
      style={{ borderColor: `${accent}55`, background: `linear-gradient(135deg, ${accent}15, transparent 70%)` }}
    >
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}25`, border: `1px solid ${accent}50` }}
          >
            <Crown className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: accent }}>
              #1 {label} Champion
            </p>
            <p className="text-base font-bold text-white truncate">{va.name}</p>
            <p className="text-xs text-slate-400">
              {va.calls} calls · {va.closes} closes
            </p>
          </div>
        </div>
        <Badge className="bg-amber-500 text-black hover:bg-amber-400">{va.score} pts</Badge>
      </CardContent>
    </Card>
  );
}

export default function AdminLeaderboard() {
  const navigate = useNavigate();
  const { data: dailyBoard = [] } = useVALeaderboard('today');
  const { data: allTimeBoard = [] } = useVALeaderboard('all_time');

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" />
            <h1 className="text-2xl font-bold text-white">VA Leaderboard</h1>
          </div>
        </div>

        {/* Champion banners */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChampionCard va={dailyBoard[0]} label="Daily" accent="#f59e0b" />
          <ChampionCard va={allTimeBoard[0]} label="All-Time" accent="#06b6d4" />
        </div>

        {/* Daily + All-Time side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-white">
                <Flame className="h-4 w-4 text-orange-400" />
                Daily Leaderboard
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dailyBoard.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No call activity today yet
                  </p>
                )}
                {dailyBoard.slice(0, 10).map((va: any, i: number) => (
                  <BoardRow key={va.va_user_id} va={va} i={i} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-white">
                <InfinityIcon className="h-4 w-4 text-cyan-400" />
                All-Time Leaderboard
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">All-time</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allTimeBoard.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No call history recorded yet
                  </p>
                )}
                {allTimeBoard.slice(0, 10).map((va: any, i: number) => (
                  <BoardRow key={va.va_user_id} va={va} i={i} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
