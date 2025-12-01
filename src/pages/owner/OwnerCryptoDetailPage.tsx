import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Coins, TrendingUp, TrendingDown, Activity } from 'lucide-react';

const cryptoAssets = [
  { symbol: 'BTC', name: 'Bitcoin', balance: 0.45, value: 19500, avgEntry: 38000, currentPrice: 43333 },
  { symbol: 'ETH', name: 'Ethereum', balance: 2.8, value: 5200, avgEntry: 1650, currentPrice: 1857 },
];

export default function OwnerCryptoDetailPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/holdings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30">
            <Coins className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Crypto Holdings</h1>
            <p className="text-sm text-muted-foreground">Digital asset portfolio</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Value</div>
            <div className="text-2xl font-bold">$24,700</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">BTC Holdings</div>
            <div className="text-2xl font-bold">0.45 BTC</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">ETH Holdings</div>
            <div className="text-2xl font-bold">2.8 ETH</div>
          </CardContent>
        </Card>
      </div>

      {/* Assets */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-orange-400" />
            Asset Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cryptoAssets.map((asset) => {
              const pnl = ((asset.currentPrice - asset.avgEntry) / asset.avgEntry) * 100;
              return (
                <div key={asset.symbol} className="p-4 rounded-lg border bg-card/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <span className="font-bold text-orange-400">{asset.symbol}</span>
                      </div>
                      <div>
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.balance} {asset.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${asset.value.toLocaleString()}</p>
                      <Badge variant="outline" className={
                        pnl >= 0 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Avg Entry:</span>
                      <span className="ml-2">${asset.avgEntry.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current:</span>
                      <span className="ml-2">${asset.currentPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Note */}
      <Card className="rounded-xl border-orange-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-orange-400 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Portfolio Note</p>
              <p className="text-sm text-muted-foreground mt-1">
                This view shows current crypto holdings. Exchange integration, DCA automation, 
                and real-time price alerts coming in the advanced Owner Suite.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
