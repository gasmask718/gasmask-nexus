import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Users, DollarSign, TrendingUp, Gift, Star, Eye, Heart, Crown } from "lucide-react";

export default function PlayboxxxDashboard() {
  const stats = [
    { label: "Active Creators", value: "156", icon: Users, change: "+23 this month", color: "text-pink-500" },
    { label: "Total Subscribers", value: "12.4K", icon: Heart, change: "+18%", color: "text-red-500" },
    { label: "Platform Revenue", value: "$284,500", icon: DollarSign, change: "+32%", color: "text-emerald-500" },
    { label: "Engagement Rate", value: "8.4%", icon: TrendingUp, change: "+2.1%", color: "text-purple-500" },
  ];

  const topCreators = [
    { name: "Luna Rose", subscribers: 2840, earnings: "$18,400", tier: "Diamond", growth: "+24%" },
    { name: "Jade Phoenix", subscribers: 2156, earnings: "$14,200", tier: "Diamond", growth: "+18%" },
    { name: "Amber Sky", subscribers: 1890, earnings: "$12,800", tier: "Gold", growth: "+31%" },
    { name: "Crystal Dawn", subscribers: 1654, earnings: "$11,200", tier: "Gold", growth: "+15%" },
    { name: "Ruby Heart", subscribers: 1432, earnings: "$9,800", tier: "Silver", growth: "+22%" },
  ];

  const getTierBadge = (tier: string) => {
    const styles: Record<string, string> = {
      "Diamond": "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30",
      "Gold": "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30",
      "Silver": "bg-gradient-to-r from-gray-400/20 to-gray-500/20 text-gray-400 border-gray-500/30",
    };
    return styles[tier] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-pink-950/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
            PlayBoxxx OS
          </h1>
          <p className="text-muted-foreground mt-1">Creator Economy & Subscription Management Platform</p>
        </div>
        <Button className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700">
          <Sparkles className="h-4 w-4 mr-2" />
          Onboard Creator
        </Button>
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
                  <p className="text-xs text-emerald-500 mt-1">{stat.change}</p>
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
      <Tabs defaultValue="creators" className="space-y-4">
        <TabsList className="bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="creators">Top Creators</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="store">Celebration Store</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="creators" className="space-y-4">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-pink-500" />
                Top Performing Creators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Rank</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Creator</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tier</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Subscribers</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Earnings (MTD)</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCreators.map((creator, i) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            {i + 1}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400" />
                            <span className="font-medium">{creator.name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={getTierBadge(creator.tier)}>
                            {creator.tier}
                          </Badge>
                        </td>
                        <td className="p-3">{creator.subscribers.toLocaleString()}</td>
                        <td className="p-3 font-semibold">{creator.earnings}</td>
                        <td className="p-3 text-emerald-500">{creator.growth}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Basic Tier", price: "$9.99/mo", subs: 4200, revenue: "$41,958" },
              { name: "Premium Tier", price: "$19.99/mo", subs: 2800, revenue: "$55,972" },
              { name: "VIP Tier", price: "$49.99/mo", subs: 890, revenue: "$44,491" },
            ].map((plan, i) => (
              <Card key={i} className="border-border/50 backdrop-blur-sm hover:border-pink-500/30 transition-colors">
                <CardContent className="p-6">
                  <div className="text-center">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-3xl font-bold text-pink-500 mt-2">{plan.price}</p>
                    <div className="mt-4 space-y-2">
                      <p className="text-sm text-muted-foreground">{plan.subs.toLocaleString()} active subscribers</p>
                      <p className="text-lg font-semibold">{plan.revenue} revenue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="payouts">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Pending Payouts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { creator: "Luna Rose", amount: "$4,600", method: "Direct Deposit", date: "Dec 5, 2025" },
                  { creator: "Jade Phoenix", amount: "$3,550", method: "PayPal", date: "Dec 5, 2025" },
                  { creator: "Amber Sky", amount: "$3,200", method: "Direct Deposit", date: "Dec 5, 2025" },
                  { creator: "Crystal Dawn", amount: "$2,800", method: "Crypto (USDT)", date: "Dec 5, 2025" },
                ].map((payout, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400" />
                      <div>
                        <p className="font-medium">{payout.creator}</p>
                        <p className="text-sm text-muted-foreground">{payout.method}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{payout.amount}</p>
                      <p className="text-sm text-muted-foreground">{payout.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="store">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Rose Bouquet", price: "$45", sales: 234, icon: "🌹" },
              { name: "Champagne Toast", price: "$85", sales: 156, icon: "🍾" },
              { name: "Diamond Ring", price: "$250", sales: 45, icon: "💍" },
              { name: "Teddy Bear XL", price: "$35", sales: 312, icon: "🧸" },
              { name: "Chocolate Box", price: "$28", sales: 445, icon: "🍫" },
              { name: "Spa Day Pass", price: "$120", sales: 89, icon: "💆" },
              { name: "Concert Tickets", price: "$180", sales: 67, icon: "🎫" },
              { name: "Custom Song", price: "$150", sales: 98, icon: "🎵" },
            ].map((item, i) => (
              <Card key={i} className="border-border/50 backdrop-blur-sm hover:border-pink-500/30 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center">
                  <span className="text-4xl">{item.icon}</span>
                  <h3 className="font-semibold mt-3">{item.name}</h3>
                  <p className="text-2xl font-bold text-pink-500 mt-1">{item.price}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.sales} sold</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { source: "Subscriptions", amount: "$142,421", pct: 50 },
                    { source: "Tips & Gifts", amount: "$85,350", pct: 30 },
                    { source: "Store Sales", amount: "$42,675", pct: 15 },
                    { source: "PPV Content", amount: "$14,054", pct: 5 },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{item.source}</span>
                        <span className="font-semibold">{item.amount}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Platform Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <Eye className="h-6 w-6 mx-auto text-blue-500" />
                    <p className="text-2xl font-bold mt-2">2.4M</p>
                    <p className="text-sm text-muted-foreground">Total Views</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <Heart className="h-6 w-6 mx-auto text-red-500" />
                    <p className="text-2xl font-bold mt-2">456K</p>
                    <p className="text-sm text-muted-foreground">Total Likes</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <Star className="h-6 w-6 mx-auto text-amber-500" />
                    <p className="text-2xl font-bold mt-2">4.8</p>
                    <p className="text-sm text-muted-foreground">Avg Rating</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <TrendingUp className="h-6 w-6 mx-auto text-emerald-500" />
                    <p className="text-2xl font-bold mt-2">+28%</p>
                    <p className="text-sm text-muted-foreground">MoM Growth</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
