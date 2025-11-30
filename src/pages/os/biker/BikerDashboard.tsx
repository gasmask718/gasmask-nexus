import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bike, MapPin, Clock, DollarSign, CheckCircle, AlertTriangle, Route, Package, Store, ClipboardCheck } from "lucide-react";

export default function BikerDashboard() {
  const stats = [
    { label: "Active Bikers", value: "24", icon: Bike, change: "18 on route", color: "text-emerald-500" },
    { label: "Stores Checked Today", value: "156", icon: Store, change: "+23 vs yesterday", color: "text-blue-500" },
    { label: "Issues Reported", value: "8", icon: AlertTriangle, change: "3 urgent", color: "text-amber-500" },
    { label: "Weekly Payouts", value: "$4,280", icon: DollarSign, change: "Due Friday", color: "text-purple-500" },
  ];

  const activeBikers = [
    { name: "Carlos Rodriguez", zone: "Downtown", stores: 12, completed: 8, status: "On Route", earnings: "$85" },
    { name: "Maria Santos", zone: "Midtown", stores: 10, completed: 10, status: "Completed", earnings: "$95" },
    { name: "James Wilson", zone: "Eastside", stores: 15, completed: 6, status: "On Route", earnings: "$72" },
    { name: "Lisa Chen", zone: "Westside", stores: 11, completed: 4, status: "On Route", earnings: "$48" },
    { name: "David Brown", zone: "Northside", stores: 13, completed: 13, status: "Completed", earnings: "$110" },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      "Completed": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      "On Route": "bg-blue-500/10 text-blue-600 border-blue-500/20",
      "Break": "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
            Bikers / Store Checkers OS
          </h1>
          <p className="text-muted-foreground mt-1">Field Operations, Store Checks & Inventory Verification</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <MapPin className="h-4 w-4 mr-2" />
            Live Map
          </Button>
          <Button className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600">
            <Route className="h-4 w-4 mr-2" />
            Assign Routes
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 bg-gradient-to-br from-background to-muted/20">
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
      <Tabs defaultValue="bikers" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="bikers">Active Bikers</TabsTrigger>
          <TabsTrigger value="routes">Today's Routes</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="bikers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bike className="h-5 w-5 text-emerald-500" />
                Active Field Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Biker</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Zone</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Progress</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">Today's Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBikers.map((biker, i) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                              {biker.name[0]}
                            </div>
                            <span className="font-medium">{biker.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{biker.zone}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-24">
                              <div 
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                                style={{ width: `${(biker.completed / biker.stores) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">{biker.completed}/{biker.stores}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={getStatusBadge(biker.status)}>
                            {biker.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-semibold text-emerald-600">{biker.earnings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routes">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { zone: "Downtown", stores: 45, assigned: 4, completed: 32, priority: "High" },
              { zone: "Midtown", stores: 38, assigned: 3, completed: 28, priority: "Medium" },
              { zone: "Eastside", stores: 52, assigned: 4, completed: 35, priority: "High" },
              { zone: "Westside", stores: 41, assigned: 3, completed: 22, priority: "Medium" },
              { zone: "Northside", stores: 35, assigned: 3, completed: 35, priority: "Low" },
              { zone: "Southside", stores: 48, assigned: 4, completed: 4, priority: "High" },
            ].map((route, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">{route.zone}</h3>
                    <Badge variant="outline" className={
                      route.priority === 'High' ? "bg-red-500/10 text-red-600" :
                      route.priority === 'Medium' ? "bg-amber-500/10 text-amber-600" :
                      "bg-emerald-500/10 text-emerald-600"
                    }>
                      {route.priority}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Stores</span>
                      <span className="font-medium">{route.stores}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bikers Assigned</span>
                      <span className="font-medium">{route.assigned}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium text-emerald-600">{route.completed}/{route.stores}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                        style={{ width: `${(route.completed / route.stores) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Reported Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { store: "Corner Mart #23", issue: "Low Stock - Grabba Leaf", biker: "Carlos R.", time: "2 hours ago", severity: "High" },
                  { store: "Quick Stop #45", issue: "Display Needs Reorganizing", biker: "Maria S.", time: "3 hours ago", severity: "Low" },
                  { store: "Gas N Go #12", issue: "Product Placement Issue", biker: "James W.", time: "4 hours ago", severity: "Medium" },
                  { store: "Smoke Shop #78", issue: "Competitor Display Prominent", biker: "Lisa C.", time: "5 hours ago", severity: "Medium" },
                ].map((issue, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        issue.severity === 'High' ? 'bg-red-500' :
                        issue.severity === 'Medium' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`} />
                      <div>
                        <p className="font-medium">{issue.store}</p>
                        <p className="text-sm text-muted-foreground">{issue.issue}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{issue.biker}</p>
                      <p className="text-xs text-muted-foreground">{issue.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <DollarSign className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Total This Week</p>
                <p className="text-3xl font-bold">$4,280</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <ClipboardCheck className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Checks Completed</p>
                <p className="text-3xl font-bold">892</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <Bike className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Avg Per Biker</p>
                <p className="text-3xl font-bold">$178</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Payout Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "David Brown", checks: 156, rate: "$0.75", bonus: "$15", total: "$132" },
                  { name: "Maria Santos", checks: 142, rate: "$0.75", bonus: "$10", total: "$116.50" },
                  { name: "Carlos Rodriguez", checks: 138, rate: "$0.75", bonus: "$5", total: "$108.50" },
                  { name: "James Wilson", checks: 125, rate: "$0.75", bonus: "$0", total: "$93.75" },
                  { name: "Lisa Chen", checks: 118, rate: "$0.75", bonus: "$0", total: "$88.50" },
                ].map((payout, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                        {payout.name[0]}
                      </div>
                      <div>
                        <p className="font-medium">{payout.name}</p>
                        <p className="text-sm text-muted-foreground">{payout.checks} checks @ {payout.rate}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-600">{payout.total}</p>
                      {payout.bonus !== "$0" && (
                        <p className="text-xs text-amber-500">+{payout.bonus} bonus</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
