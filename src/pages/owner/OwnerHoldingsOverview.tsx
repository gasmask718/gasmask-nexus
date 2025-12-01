import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Building,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Home,
  Wallet,
  PiggyBank,
  LineChart,
  ArrowUpRight,
  Landmark,
  Bot,
  Coins,
  Trophy,
  ChevronRight,
} from 'lucide-react';

const realEstateHoldings = {
  totalProperties: 8,
  totalEquity: 450000,
  totalLoans: 1200000,
  monthlyIncome: 12500,
  appreciation: 8.5,
  properties: [
    { id: 'prop-1', name: 'Rental Property #1', value: 320000, equity: 120000, income: 2800, status: 'Occupied' },
    { id: 'prop-2', name: 'Rental Property #2', value: 285000, equity: 95000, income: 2400, status: 'Occupied' },
    { id: 'prop-3', name: 'Rental Property #3', value: 375000, equity: 135000, income: 3200, status: 'Occupied' },
    { id: 'prop-4', name: 'Airbnb Unit #1', value: 180000, equity: 60000, income: 2800, status: 'Active' },
    { id: 'prop-5', name: 'Commercial Space', value: 520000, equity: 40000, income: 1300, status: 'Leased' },
  ],
};

const financialHoldings = {
  portfolioValue: 185000,
  cashReserves: 75000,
  cryptoValue: 42000,
  stocksValue: 143000,
  monthlyChange: 4.2,
  allocations: [
    { id: 'index-funds', name: 'Index Funds', value: 85000, percentage: 46, trend: +3.2 },
    { id: 'individual-stocks', name: 'Individual Stocks', value: 58000, percentage: 31, trend: +5.8 },
    { id: 'crypto', name: 'Crypto (BTC/ETH)', value: 42000, percentage: 23, trend: -2.1 },
  ],
};

const incomingCapital = {
  fundingPipeline: 125000,
  grantsPending: 45000,
  accountsReceivable: 32000,
};

const autoTradingAI = {
  id: 'auto-trading',
  totalEquity: 28500,
  monthlyROI: 7.2,
  winRate: 62,
  activeBots: 3,
};

const cryptoHoldings = {
  id: 'crypto',
  btcBalance: 0.45,
  ethBalance: 2.8,
  btcValue: 19500,
  ethValue: 5200,
  totalValue: 24700,
  avgEntry: { btc: 38000, eth: 1650 },
};

const sportsBettingAI = {
  id: 'sports-betting',
  bankroll: 15400,
  winRate: 58,
  monthlyROI: 12.5,
  lastBets: [
    { game: 'NFL: Chiefs vs Ravens', result: 'W', amount: 200 },
    { game: 'NBA: Lakers vs Celtics', result: 'L', amount: 150 },
    { game: 'UFC: Main Event', result: 'W', amount: 300 },
  ],
};

export default function OwnerHoldingsOverview() {
  const navigate = useNavigate();
  const totalNetWorth = 
    realEstateHoldings.totalEquity + 
    financialHoldings.portfolioValue + 
    financialHoldings.cashReserves;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30">
            <Building className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Holdings Overview</h1>
            <p className="text-sm text-muted-foreground">
              Dynasty wealth and asset management
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 w-fit">
          <TrendingUp className="h-3 w-3 mr-1" />
          Net Worth: ${(totalNetWorth / 1000).toFixed(0)}K
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Real Estate Equity</p>
                <p className="text-2xl font-bold">${(realEstateHoldings.totalEquity / 1000).toFixed(0)}K</p>
              </div>
              <Home className="h-6 w-6 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Investment Portfolio</p>
                <p className="text-2xl font-bold">${(financialHoldings.portfolioValue / 1000).toFixed(0)}K</p>
              </div>
              <LineChart className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cash Reserves</p>
                <p className="text-2xl font-bold">${(financialHoldings.cashReserves / 1000).toFixed(0)}K</p>
              </div>
              <PiggyBank className="h-6 w-6 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Income</p>
                <p className="text-2xl font-bold">${realEstateHoldings.monthlyIncome.toLocaleString()}</p>
              </div>
              <DollarSign className="h-6 w-6 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Real Estate Holdings */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-emerald-400" />
                <CardTitle className="text-base">Real Estate Holdings</CardTitle>
              </div>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                +{realEstateHoldings.appreciation}% YoY
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {realEstateHoldings.totalProperties} properties • ${(realEstateHoldings.totalLoans / 1000).toFixed(0)}K in loans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {realEstateHoldings.properties.map((property) => (
                <div 
                  key={property.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card/50 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate(`/os/owner/holdings/property/${property.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium">{property.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Equity: ${(property.equity / 1000).toFixed(0)}K • Income: ${property.income}/mo
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    property.status === 'Occupied' || property.status === 'Active' || property.status === 'Leased'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  )}>
                    {property.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Financial Holdings */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-400" />
                <CardTitle className="text-base">Financial Holdings</CardTitle>
              </div>
              <Badge variant="outline" className={cn(
                financialHoldings.monthlyChange > 0
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              )}>
                {financialHoldings.monthlyChange > 0 ? '+' : ''}{financialHoldings.monthlyChange}% MTD
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Portfolio allocation and performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {financialHoldings.allocations.map((allocation) => (
              <div 
                key={allocation.id} 
                className="space-y-2 cursor-pointer hover:bg-muted/30 p-2 rounded-lg transition-colors -mx-2"
                onClick={() => navigate(`/os/owner/holdings/financial/${allocation.id}`)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{allocation.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">${(allocation.value / 1000).toFixed(0)}K</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      allocation.trend > 0
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    )}>
                      {allocation.trend > 0 ? '+' : ''}{allocation.trend}%
                    </Badge>
                  </div>
                </div>
                <Progress value={allocation.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Incoming Capital */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-purple-400" />
            <CardTitle className="text-base">Incoming Capital</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Expected inflows from business operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-card/50">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-muted-foreground">Funding Pipeline</span>
              </div>
              <p className="text-xl font-bold">${(incomingCapital.fundingPipeline / 1000).toFixed(0)}K</p>
              <p className="text-xs text-muted-foreground">Expected fees from active files</p>
            </div>
            <div className="p-4 rounded-lg border bg-card/50">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-muted-foreground">Grants Pending</span>
              </div>
              <p className="text-xl font-bold">${(incomingCapital.grantsPending / 1000).toFixed(0)}K</p>
              <p className="text-xs text-muted-foreground">Client grants in approval stage</p>
            </div>
            <div className="p-4 rounded-lg border bg-card/50">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-muted-foreground">Accounts Receivable</span>
              </div>
              <p className="text-xl font-bold">${(incomingCapital.accountsReceivable / 1000).toFixed(0)}K</p>
              <p className="text-xs text-muted-foreground">Outstanding invoices</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Holdings Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Auto-Trading AI */}
        <Card 
          className="rounded-xl border-cyan-500/30 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate('/os/owner/holdings/auto-trading')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-cyan-400" />
                <CardTitle className="text-base">Auto-Trading AI</CardTitle>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Equity</span>
              <span className="font-bold">${autoTradingAI.totalEquity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Monthly ROI</span>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                +{autoTradingAI.monthlyROI}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Win Rate</span>
              <span className="text-sm">{autoTradingAI.winRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Bots</span>
              <span className="text-sm">{autoTradingAI.activeBots}</span>
            </div>
          </CardContent>
        </Card>

        {/* Crypto Holdings */}
        <Card 
          className="rounded-xl border-orange-500/30 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate('/os/owner/holdings/crypto')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-orange-400" />
                <CardTitle className="text-base">Crypto Holdings</CardTitle>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Value</span>
              <span className="font-bold">${cryptoHoldings.totalValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">BTC</span>
              <span className="text-sm">{cryptoHoldings.btcBalance} BTC (${(cryptoHoldings.btcValue / 1000).toFixed(1)}K)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">ETH</span>
              <span className="text-sm">{cryptoHoldings.ethBalance} ETH (${(cryptoHoldings.ethValue / 1000).toFixed(1)}K)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Entry (BTC)</span>
              <span className="text-sm">${cryptoHoldings.avgEntry.btc.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Sports Betting AI */}
        <Card 
          className="rounded-xl border-green-500/30 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate('/os/owner/holdings/sports')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-green-400" />
                <CardTitle className="text-base">Sports Betting AI</CardTitle>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Bankroll</span>
              <span className="font-bold">${sportsBettingAI.bankroll.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Win Rate</span>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                {sportsBettingAI.winRate}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Monthly ROI</span>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                +{sportsBettingAI.monthlyROI}%
              </Badge>
            </div>
            <div className="space-y-1 mt-2">
              <span className="text-xs text-muted-foreground">Recent Bets:</span>
              {sportsBettingAI.lastBets.map((bet, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="truncate max-w-[150px]">{bet.game}</span>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    bet.result === 'W' 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'
                  )}>
                    {bet.result} ${bet.amount}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
