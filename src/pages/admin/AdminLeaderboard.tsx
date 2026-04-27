import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, ArrowLeft, Flame, Calendar } from 'lucide-react';
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

export default function AdminLeaderboard() {
  const navigate = useNavigate();
  const { data: todayBoard = [] } = useVALeaderboard('today');
  const { data: monthBoard = [] } = useVALeaderboard('month');
  const { data: lastMonthBoard = [] } = useVALeaderboard('last_month');

  const lastMonthLabel = new Date(
    new Date().getFullYear(),
    new Date().getMonth() - 1,
    1,
  ).toLocaleString('en-US', { month: 'long', year: 'numeric' });

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

        {/* Last Month's Champion */}
        {lastMonthBoard[0] && (
          <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-white">
                <Trophy className="h-4 w-4 text-amber-400" />
                Last Month's Champion
                <Badge
                  variant="outline"
                  className="ml-auto text-[10px] border-amber-500/30 text-amber-300"
                >
                  {lastMonthLabel}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold">
                    #1
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">
                      {(lastMonthBoard[0] as any).name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(lastMonthBoard[0] as any).calls} calls ·{' '}
                      {(lastMonthBoard[0] as any).closes} closes
                    </p>
                  </div>
                </div>
                <Badge className="bg-amber-500 text-black hover:bg-amber-400">
                  {(lastMonthBoard[0] as any).score} pts
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today + This Month side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-white">
                <Flame className="h-4 w-4 text-orange-400" />
                Today's Leaderboard
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todayBoard.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No call activity today yet
                  </p>
                )}
                {todayBoard.slice(0, 10).map((va: any, i: number) => (
                  <BoardRow key={va.va_user_id} va={va} i={i} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-white">
                <Calendar className="h-4 w-4 text-cyan-400" />
                This Month's Leaderboard
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {new Date().toLocaleString('en-US', { month: 'long' })}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monthBoard.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No activity this month yet
                  </p>
                )}
                {monthBoard.slice(0, 10).map((va: any, i: number) => (
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
