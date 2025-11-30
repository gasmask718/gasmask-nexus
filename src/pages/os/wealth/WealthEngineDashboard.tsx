import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, DollarSign, BarChart3, Wallet, Bot, LineChart, PieChart, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

export default function WealthEngineDashboard() {
  const stats = [
    { label: "Total Portfolio", value: "$4.2M", icon: Wallet, change: "+12.4%", color: "text-emerald-500", positive: true },
    { label: "Today's P/L", value: "+$18,450", icon: TrendingUp, change: "+2.1%", color: "text-emerald-500", positive: true },
    { label: "Active Bots", value: "8", icon: Bot, change: "3 trading", color: "text-blue-500", positive: true },
    { label: "Win Rate", value: "73%", icon: Activity, change: "+5%", color: "text-purple-500", positive: true },
  ];

  const portfolioHoldings = [
    { symbol: "AAPL", name: "Apple Inc", shares: 150, price: "$189.45", value: "$28,417", change: "+2.3%", positive: true },
    { symbol: "MSFT", name: "Microsoft Corp", shares: 100, price: "$378.91", value: "$37,891", change: "+1.8%", positive: true },
    { symbol: "GOOGL", name: "Alphabet Inc", shares: 50, price: "$141.80", value: "$7,090", change: "-0.5%", positive: false },
    { symbol: "NVDA", name: "NVIDIA Corp", shares: 75, price: "$467.65", value: "$35,073", change: "+4.2%", positive: true },
    { symbol: "TSLA", name: "Tesla Inc", shares: 80, price: "$238.45", value: "$19,076", change: "-1.2%", positive: false },
  ];

  const cryptoHoldings = [
    { symbol: "BTC", name: "Bitcoin", amount: "2.5", price: "$96,450", value: "$241,125", change: "+5.2%", positive: true },
    { symbol: "ETH", name: "Ethereum", amount: "25", price: "$3,580", value: "$89,500", change: "+3.8%", positive: true },
    { symbol: "SOL", name: "Solana", amount: "500", price: "$235", value: "$117,500", change: "+8.4%", positive: true },
    { symbol: "LINK", name: "Chainlink", amount: "1000", price: "$24.50", value: "$24,500", change: "+2.1%", positive: true },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-emerald-950/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
            Wealth Engine OS
          </h1>
          <p className="text-muted-foreground mt-1">Investment Portfolio, Trading Bots & Financial Intelligence</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button className="bg-gradient-to-r from-emerald-600 to-cyan-500 hover:from-emerald-700 hover:to-cyan-600">
            <Bot className="h-4 w-4 mr-2" />
            Trading Bots
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 bg-gradient-to-br from-background to-muted/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <p className={`text-xs mt-1 ${stat.positive ? 'text-emerald-500' : 'text-red-500'}`}>{stat.change}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="stocks" className="space-y-4">
        <TabsList className="bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="stocks">Stocks</TabsTrigger>
          <TabsTrigger value="crypto">Crypto</TabsTrigger>
          <TabsTrigger value="bots">Trading Bots</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="stocks" className="space-y-4">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-emerald-500" />
                Stock Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Symbol</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">Shares</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">Price</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">Value</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioHoldings.map((holding) => (
                      <tr key={holding.symbol} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-bold">{holding.symbol}</td>
                        <td className="p-3 text-muted-foreground">{holding.name}</td>
                        <td className="p-3 text-right">{holding.shares}</td>
                        <td className="p-3 text-right">{holding.price}</td>
                        <td className="p-3 text-right font-semibold">{holding.value}</td>
                        <td className={`p-3 text-right font-semibold flex items-center justify-end gap-1 ${holding.positive ? 'text-emerald-500' : 'text-red-500'}`}>
                          {holding.positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          {holding.change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crypto" className="space-y-4">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-500" />
                Crypto Holdings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Asset</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">Price</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">Value</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">24h Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cryptoHoldings.map((holding) => (
                      <tr key={holding.symbol} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-bold">{holding.symbol}</td>
                        <td className="p-3 text-muted-foreground">{holding.name}</td>
                        <td className="p-3 text-right">{holding.amount}</td>
                        <td className="p-3 text-right">{holding.price}</td>
                        <td className="p-3 text-right font-semibold">{holding.value}</td>
                        <td className={`p-3 text-right font-semibold flex items-center justify-end gap-1 ${holding.positive ? 'text-emerald-500' : 'text-red-500'}`}>
                          {holding.positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          {holding.change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bots">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Momentum Bot", status: "Active", strategy: "Trend Following", profit: "+$4,250", trades: 145, winRate: "72%" },
              { name: "Mean Reversion Bot", status: "Active", strategy: "Statistical Arbitrage", profit: "+$2,890", trades: 234, winRate: "68%" },
              { name: "Scalping Bot", status: "Active", strategy: "High Frequency", profit: "+$1,560", trades: 1245, winRate: "71%" },
              { name: "Swing Trade Bot", status: "Paused", strategy: "Multi-Day Holds", profit: "+$8,920", trades: 45, winRate: "78%" },
              { name: "DCA Bot (BTC)", status: "Active", strategy: "Dollar Cost Average", profit: "+$12,450", trades: 52, winRate: "N/A" },
              { name: "Grid Bot (ETH)", status: "Active", strategy: "Grid Trading", profit: "+$3,180", trades: 890, winRate: "65%" },
            ].map((bot, i) => (
              <Card key={i} className="border-border/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Bot className={`h-8 w-8 ${bot.status === 'Active' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      <div>
                        <h3 className="font-semibold">{bot.name}</h3>
                        <p className="text-xs text-muted-foreground">{bot.strategy}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={bot.status === 'Active' ? "bg-emerald-500/10 text-emerald-600" : "bg-muted"}>
                      {bot.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Profit</p>
                      <p className="font-bold text-emerald-500">{bot.profit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Trades</p>
                      <p className="font-bold">{bot.trades}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="font-bold">{bot.winRate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Portfolio Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { asset: "Stocks", value: "$127,547", pct: 45, color: "bg-blue-500" },
                    { asset: "Crypto", value: "$472,625", pct: 35, color: "bg-amber-500" },
                    { asset: "Cash", value: "$42,000", pct: 10, color: "bg-emerald-500" },
                    { asset: "Bonds", value: "$42,000", pct: 10, color: "bg-purple-500" },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{item.asset}</span>
                        <span className="font-semibold">{item.value} ({item.pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "YTD Return", value: "+34.2%", icon: TrendingUp },
                    { label: "Sharpe Ratio", value: "1.85", icon: BarChart3 },
                    { label: "Max Drawdown", value: "-8.4%", icon: Activity },
                    { label: "Beta", value: "1.12", icon: LineChart },
                  ].map((metric, i) => (
                    <div key={i} className="p-4 rounded-lg bg-muted/30 text-center">
                      <metric.icon className="h-6 w-6 mx-auto text-emerald-500" />
                      <p className="text-2xl font-bold mt-2">{metric.value}</p>
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
