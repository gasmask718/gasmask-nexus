import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, TrendingUp, Target, Activity } from 'lucide-react';

const recentBets = [
  { id: 1, game: 'NFL: Chiefs vs Ravens', pick: 'Chiefs -3', stake: 200, result: 'W', payout: '+$180' },
  { id: 2, game: 'NBA: Lakers vs Celtics', pick: 'Over 215.5', stake: 150, result: 'L', payout: '-$150' },
  { id: 3, game: 'UFC 298: Main Event', pick: 'Fighter A by KO', stake: 300, result: 'W', payout: '+$450' },
  { id: 4, game: 'NFL: Eagles vs Cowboys', pick: 'Eagles ML', stake: 250, result: 'W', payout: '+$200' },
  { id: 5, game: 'NBA: Warriors vs Suns', pick: 'Warriors -5', stake: 200, result: 'W', payout: '+$180' },
];

export default function OwnerSportsDetailPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/holdings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30">
            <Trophy className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Sports Betting AI</h1>
            <p className="text-sm text-muted-foreground">AI-powered sports analysis</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Bankroll</div>
            <div className="text-2xl font-bold">$15,400</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Win Rate</div>
            <div className="text-2xl font-bold text-emerald-400">58%</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Monthly ROI</div>
            <div className="text-2xl font-bold text-emerald-400">+12.5%</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Units Won (MTD)</div>
            <div className="text-2xl font-bold">+8.6</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bets */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-green-400" />
            Recent Bets
          </CardTitle>
          <CardDescription className="text-xs">Last 5 wagers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentBets.map((bet) => (
              <div key={bet.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                <div>
                  <p className="font-medium text-sm">{bet.game}</p>
                  <p className="text-xs text-muted-foreground">{bet.pick} • ${bet.stake}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={bet.result === 'W' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {bet.payout}
                  </span>
                  <Badge variant="outline" className={
                    bet.result === 'W' 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'
                  }>
                    {bet.result}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card className="rounded-xl border-green-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-green-400 mt-0.5" />
            <div>
              <p className="font-medium text-sm">AI Recommendation</p>
              <p className="text-sm text-muted-foreground mt-1">
                Bankroll is healthy. Stick to 1-2 unit plays on high-confidence edges. 
                Avoid parlays and live betting. Today's slate has 2 identified value plays. 
                Full AI picks dashboard coming in the advanced Owner Suite.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
