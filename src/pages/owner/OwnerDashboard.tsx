import React from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Brain,
  Building2,
  ChevronRight,
  Cpu,
  DollarSign,
  Factory,
  LineChart,
  Users,
  Crown,
} from "lucide-react";

const businesses = [
  { id: "gasmask", name: "GasMask / Grabba OS", revenue: "$128,450", status: "Healthy", issues: 2, note: "Inventory & routes stable" },
  { id: "hotmama", name: "HotMama Grabba", revenue: "$24,980", status: "Watch", issues: 3, note: "Need more ambassadors in NYC" },
  { id: "toptier", name: "TopTier Experience", revenue: "$58,320", status: "Healthy", issues: 1, note: "Weekend bookings growing" },
  { id: "unforgettable", name: "Unforgettable Times USA", revenue: "$32,740", status: "Watch", issues: 2, note: "Hall availability tight this month" },
  { id: "playboxxx", name: "PlayBoxxx", revenue: "$76,910", status: "Healthy", issues: 1, note: "Creator growth strong" },
  { id: "iclean", name: "iClean WeClean", revenue: "$21,560", status: "Healthy", issues: 0, note: "Contracts stable" },
  { id: "funding", name: "Funding Company", revenue: "$39,200", status: "Watch", issues: 4, note: "Several files stuck in underwriting" },
  { id: "grants", name: "Grant Company", revenue: "$18,400", status: "Healthy", issues: 1, note: "Upcoming deadlines under control" },
  { id: "wealth", name: "Wealth Engine", revenue: "$42,600", status: "Healthy", issues: 0, note: "Bots running profitably" },
  { id: "sports", name: "Sports Betting AI", revenue: "$25,380", status: "Healthy", issues: 0, note: "Edge stable across markets" },
];

const automations = [
  { name: "Auto Text Follow-Up Engine", system: "Communication OS", status: "Active", lastRun: "3 min ago" },
  { name: "TopTier Lead Nurture Sequence", system: "TopTier OS", status: "Active", lastRun: "12 min ago" },
  { name: "Grant Deadline Watcher", system: "Grant Company OS", status: "Degraded", lastRun: "45 min ago" },
  { name: "Funding Pipeline Monitor", system: "Funding Company OS", status: "Active", lastRun: "8 min ago" },
  { name: "Sports Betting Bankroll Guard", system: "Sports Betting AI", status: "Active", lastRun: "1 min ago" },
];

const workforceSummary = [
  { name: "Drivers", count: 50, tasksToday: 120, status: "Strong", note: "On-time rate 94%" },
  { name: "Bikers / Store Checkers", count: 24, tasksToday: 310, status: "OK", note: "Some zones need new coverage" },
  { name: "VAs", count: 6, tasksToday: 84, status: "Strong", note: "Admin and CRM up-to-date" },
  { name: "Ambassadors", count: 40, tasksToday: 65, status: "Needs focus", note: "More content & campaigns required" },
];

const alerts = [
  { type: "Critical", system: "Funding Company", message: "1 large file in underwriting over SLA by 3 days", time: "1h ago" },
  { type: "Warning", system: "TopTier Experience", message: "3 bookings missing payment confirmation", time: "3h ago" },
  { type: "Warning", system: "PlayBoxxx", message: "2 creator payout reviews pending approval", time: "5h ago" },
  { type: "Info", system: "GasMask / Grabba", message: "5 stores flagged for low inventory", time: "Today" },
];

const activity = [
  { title: "Updated TopTier pricing matrix", detail: "Adjusted weekend rates for NYC & ATL fleets", time: "2h ago" },
  { title: "Activated Sports Betting AI OS", detail: "Enabled hedge calculator and AI picks dashboard", time: "Yesterday" },
  { title: "Added new wholesaler region", detail: "Expanded GasMask coverage into new borough", time: "2 days ago" },
  { title: "Approved grant applications batch", detail: "3 clients moved to Approved stage", time: "3 days ago" },
];

const revenueBars = [
  { month: "Jul", value: 52 },
  { month: "Aug", value: 68 },
  { month: "Sep", value: 75 },
  { month: "Oct", value: 83 },
  { month: "Nov", value: 92 },
  { month: "Dec", value: 100 },
];

function statusBadge(status: string) {
  switch (status) {
    case "Healthy": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "Watch": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "Critical": return "bg-red-500/10 text-red-400 border-red-500/30";
    case "Strong": return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    case "OK": return "bg-blue-500/10 text-blue-300 border-blue-500/30";
    case "Needs focus": return "bg-amber-500/10 text-amber-300 border-amber-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function automationStatus(s: string) {
  switch (s) {
    case "Active": return "text-emerald-400";
    case "Degraded": return "text-amber-400";
    case "Paused": return "text-red-400";
    default: return "text-muted-foreground";
  }
}

const OwnerDashboard: React.FC = () => {
  const { role, isAdmin } = useUserRole();

  if (!isAdmin()) {
    return (
      <div className="flex h-full items-center justify-center min-h-[60vh]">
        <Card className="max-w-md border-red-500/40 bg-red-950/40">
          <CardHeader className="flex flex-row items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-400" />
            <div>
              <CardTitle>Access denied</CardTitle>
              <CardDescription>This page is restricted to Owner / Admin accounts.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-red-100/80">
            Your current role is <span className="font-semibold">{role ?? "unknown"}</span>.
            If you believe this is an error, verify your admin role in the database.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-400" />
            Owner Control Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Unified view across all Dynasty OS systems, businesses, and automations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-emerald-500/60 bg-emerald-900/40 text-emerald-200">
            ADMIN
          </Badge>
          <Button variant="outline" size="sm" className="gap-2">
            <Brain className="h-4 w-4" />
            AI Summary
          </Button>
          <Button size="sm" className="gap-2">
            <LineChart className="h-4 w-4" />
            Export Snapshot
          </Button>
        </div>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Empire Revenue (MTD)</CardDescription>
            <CardTitle className="flex items-baseline gap-2">
              <span className="text-2xl">$428,540</span>
              <span className="text-xs font-medium text-emerald-500">+18.4% vs last month</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Aggregated across all active OS units and channels.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active OS Systems</CardDescription>
            <CardTitle className="flex items-baseline gap-2">
              <span className="text-2xl">10</span>
              <span className="text-xs font-medium text-emerald-500">All systems online</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Includes Grabba, TopTier, PlayBoxxx, Funding, Grants, Wealth, Sports Betting, and more.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Automations</CardDescription>
            <CardTitle className="flex items-baseline gap-2">
              <span className="text-2xl">34</span>
              <span className="text-xs font-medium text-blue-400">Workflows running</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Text sequences, call flows, grant pipelines, funding monitors, OS watchdogs, and more.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Alerts</CardDescription>
            <CardTitle className="flex items-baseline gap-2">
              <span className="text-2xl">7</span>
              <span className="text-xs font-medium text-amber-400">Needs review</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Time-sensitive issues across funding, grants, bookings, inventory, and payouts.
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Revenue + Cash */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <LineChart className="h-4 w-4 text-emerald-400" />
                Empire Revenue Overview
              </CardTitle>
              <CardDescription>Summarized across all businesses (last 6 months)</CardDescription>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">Live Mode</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-40">
              {revenueBars.map((bar) => (
                <div key={bar.month} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/30 to-emerald-400/70"
                    style={{ height: `${bar.value}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{bar.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Trend: steady growth with acceleration in Q4.</span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Volatility: moderate
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Cash & Liquidity
            </CardTitle>
            <CardDescription>High-level cash position across accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Available Cash</p>
                <p className="font-medium">$186,200</p>
              </div>
              <Badge variant="outline" className="text-emerald-300 border-emerald-500/40">Banks</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Credit Lines Available</p>
                <p className="font-medium">$420,000</p>
              </div>
              <Badge variant="outline" className="text-blue-300 border-blue-500/40">Revolving</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Payouts</p>
                <p className="font-medium">$24,850</p>
              </div>
              <Badge variant="outline" className="text-amber-300 border-amber-500/40">Creators & Contractors</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Accounts Receivable</p>
                <p className="font-medium">$67,900</p>
              </div>
              <Badge variant="outline" className="text-purple-300 border-purple-500/40">Net 30 / 45</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Business Performance Grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Factory className="h-4 w-4 text-emerald-400" />
              Business Performance — At a Glance
            </CardTitle>
            <CardDescription>Each OS unit summarized for the owner.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            View Details
            <ChevronRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {businesses.map((biz) => (
              <div key={biz.id} className="rounded-lg border bg-card/60 p-3 text-sm flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-300" />
                    <span className="font-medium">{biz.name}</span>
                  </div>
                  <Badge variant="outline" className={cn("border px-2 py-0.5 text-[10px] font-semibold", statusBadge(biz.status))}>
                    {biz.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Revenue MTD</span>
                  <span className="font-semibold text-foreground">{biz.revenue}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Open issues</span>
                  <span className={biz.issues > 0 ? "text-amber-400" : "text-emerald-400"}>
                    {biz.issues} {biz.issues === 1 ? "item" : "items"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{biz.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Row 4: Tabs — AI Advisor / Automations / Workforce */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            Empire Intelligence
          </CardTitle>
          <CardDescription>AI advisor, automation health, and workforce view.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="advisor" className="space-y-4">
            <TabsList>
              <TabsTrigger value="advisor">AI Advisor</TabsTrigger>
              <TabsTrigger value="automations">Automations</TabsTrigger>
              <TabsTrigger value="workforce">Workforce</TabsTrigger>
            </TabsList>

            <TabsContent value="advisor" className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Card className="border-emerald-500/30 bg-emerald-950/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-emerald-300" />
                      Biggest Opportunity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-emerald-50/90">
                    Scale TopTier Experience in NYC & ATL using bundled "Black Truck + Roses" celebration campaigns and influencer pushes.
                  </CardContent>
                </Card>
                <Card className="border-amber-500/30 bg-amber-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                      Biggest Risk
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-amber-50/90">
                    A few funding and grant files are over SLA. Create a hard rule that any file over 48 hours gets a forced follow-up and escalated review.
                  </CardContent>
                </Card>
                <Card className="border-blue-500/30 bg-blue-950/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-300" />
                      Quick Win
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-blue-50/90">
                    Raise weekend base price on black trucks by $10 and bundle roses to increase average order value with minimal added cost.
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="automations" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Key automations across communication, funding, grants, and sports systems.
              </p>
              <div className="space-y-2">
                {automations.map((auto, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">{auto.name}</span>
                      <span className="text-xs text-muted-foreground">{auto.system}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className={automationStatus(auto.status)}>{auto.status}</span>
                      <span className="text-muted-foreground">Last run: {auto.lastRun}</span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="workforce" className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {workforceSummary.map((w) => (
                  <Card key={w.name} className="bg-card/70 text-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-300" />
                        {w.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Active</span>
                        <span className="font-semibold text-foreground">{w.count}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Tasks today</span>
                        <span className="font-semibold text-foreground">{w.tasksToday}</span>
                      </div>
                      <Badge variant="outline" className={cn("mt-1 border px-2 py-0.5 text-[10px]", statusBadge(w.status))}>
                        {w.status}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{w.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Row 5: Alerts & Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Critical Alerts
              </CardTitle>
              <CardDescription>Issues that may need direct owner attention.</CardDescription>
            </div>
            <Badge variant="outline" className="text-amber-200 border-amber-500/40">{alerts.length} open</Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {alerts.map((alert, idx) => (
              <div key={idx} className="flex flex-col gap-1 rounded-md border bg-card/70 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-2 py-0.5 text-[10px]",
                        alert.type === "Critical" && "border-red-500/50 text-red-300",
                        alert.type === "Warning" && "border-amber-500/50 text-amber-300",
                        alert.type === "Info" && "border-blue-500/40 text-blue-300",
                      )}
                    >
                      {alert.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{alert.system}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{alert.time}</span>
                </div>
                <p className="text-xs text-foreground">{alert.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Recent Owner Activity
              </CardTitle>
              <CardDescription>High-level actions across your empire.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {activity.map((item, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    {idx < activity.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-muted" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs">{item.title}</span>
                      <span className="text-[11px] text-muted-foreground">{item.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OwnerDashboard;
