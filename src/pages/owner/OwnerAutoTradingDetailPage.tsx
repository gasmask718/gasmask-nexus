import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bot, TrendingUp, Activity, Zap } from 'lucide-react';

const tradingBots = [
  { id: 'bot-1', name: 'Momentum Scalper', status: 'Active', trades: 145, winRate: 64, pnl: '+$2,450' },
  { id: 'bot-2', name: 'Mean Reversion', status: 'Active', trades: 89, winRate: 58, pnl: '+$1,280' },
  { id: 'bot-3', name: 'Breakout Hunter', status: 'Paused', trades: 67, winRate: 52, pnl: '+$890' },
];

export default function OwnerAutoTradingDetailPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/holdings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30">
            <Bot className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Auto-Trading AI</h1>
            <p className="text-sm text-muted-foreground">Algorithmic trading performance</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Equity</div>
            <div className="text-2xl font-bold">$28,500</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Monthly ROI</div>
            <div className="text-2xl font-bold text-emerald-400">+7.2%</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Win Rate</div>
            <div className="text-2xl font-bold">62%</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Active Bots</div>
            <div className="text-2xl font-bold">3</div>
          </CardContent>
        </Card>
      </div>

      {/* Bots List */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            Trading Bots
          </CardTitle>
          <CardDescription className="text-xs">Active algorithmic strategies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tradingBots.map((bot) => (
              <div key={bot.id} className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                <div>
                  <p className="font-medium">{bot.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {bot.trades} trades • {bot.winRate}% win rate
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-emerald-400">{bot.pnl}</span>
                  <Badge variant="outline" className={
                    bot.status === 'Active' 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }>
                    {bot.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Note */}
      <Card className="rounded-xl border-cyan-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-cyan-400 mt-0.5" />
            <div>
              <p className="font-medium text-sm">AI Performance Note</p>
              <p className="text-sm text-muted-foreground mt-1">
                This module displays automated trading performance. Full bot management, 
                strategy configuration, and real-time monitoring coming in the advanced Owner Suite.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
