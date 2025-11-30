import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Layers,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  ChevronRight,
  Building2,
  Sparkles,
  Car,
  DollarSign,
  Gamepad2,
} from 'lucide-react';

const clusters = [
  {
    id: 'grabba',
    name: 'Grabba Cluster',
    businesses: ['GasMask Approved', 'Hot Mama', 'Scalati', 'Grabba R Us'],
    icon: Building2,
    color: 'emerald',
    revenueMTD: 145000,
    trend: +12,
    openRisks: 3,
    automationCoverage: 85,
    status: 'Healthy',
  },
  {
    id: 'experiences',
    name: 'Experiences Cluster',
    businesses: ['TopTier Experience', 'Unforgettable Times'],
    icon: Sparkles,
    color: 'purple',
    revenueMTD: 68000,
    trend: +24,
    openRisks: 1,
    automationCoverage: 72,
    status: 'Growing',
  },
  {
    id: 'platforms',
    name: 'Platforms Cluster',
    businesses: ['Playboxxx', 'Sports Betting AI', 'Special Needs Transport'],
    icon: Gamepad2,
    color: 'pink',
    revenueMTD: 42000,
    trend: +8,
    openRisks: 2,
    automationCoverage: 60,
    status: 'Developing',
  },
  {
    id: 'wealth',
    name: 'Wealth & Finance Cluster',
    businesses: ['Funding Company', 'Grant Company', 'Wealth Engine', 'Real Estate Holdings'],
    icon: DollarSign,
    color: 'amber',
    revenueMTD: 95000,
    trend: -3,
    openRisks: 5,
    automationCoverage: 55,
    status: 'Watch',
  },
];

export default function OwnerClusterDashboard() {
  const totalRevenue = clusters.reduce((sum, c) => sum + c.revenueMTD, 0);
  const totalRisks = clusters.reduce((sum, c) => sum + c.openRisks, 0);
  const avgAutomation = Math.round(clusters.reduce((sum, c) => sum + c.automationCoverage, 0) / clusters.length);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30">
            <Layers className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Cluster Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Empire-wide view of business clusters
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Revenue MTD</p>
            <p className="text-2xl font-bold">${(totalRevenue / 1000).toFixed(0)}K</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active Clusters</p>
            <p className="text-2xl font-bold">{clusters.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Open Risks</p>
            <p className="text-2xl font-bold text-amber-400">{totalRisks}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Automation</p>
            <p className="text-2xl font-bold">{avgAutomation}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Clusters Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {clusters.map((cluster) => (
          <ClusterCard key={cluster.id} cluster={cluster} />
        ))}
      </div>
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: typeof clusters[0] }) {
  const colorVariants = {
    emerald: {
      bg: 'from-emerald-950/50 to-emerald-900/20',
      border: 'border-emerald-500/30',
      icon: 'bg-emerald-500/20 text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    purple: {
      bg: 'from-purple-950/50 to-purple-900/20',
      border: 'border-purple-500/30',
      icon: 'bg-purple-500/20 text-purple-400',
      badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    pink: {
      bg: 'from-pink-950/50 to-pink-900/20',
      border: 'border-pink-500/30',
      icon: 'bg-pink-500/20 text-pink-400',
      badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    },
    amber: {
      bg: 'from-amber-950/50 to-amber-900/20',
      border: 'border-amber-500/30',
      icon: 'bg-amber-500/20 text-amber-400',
      badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
  };

  const colors = colorVariants[cluster.color as keyof typeof colorVariants];

  const statusColors = {
    Healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Growing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Developing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Watch: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <Card className={cn("rounded-xl bg-gradient-to-br", colors.bg, colors.border)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", colors.icon)}>
              <cluster.icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{cluster.name}</CardTitle>
              <CardDescription className="text-xs">
                {cluster.businesses.length} businesses
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={statusColors[cluster.status as keyof typeof statusColors]}>
            {cluster.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Businesses List */}
        <div className="flex flex-wrap gap-1.5">
          {cluster.businesses.map((biz) => (
            <Badge key={biz} variant="outline" className="text-[10px] bg-background/50">
              {biz}
            </Badge>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Revenue MTD</p>
            <p className="text-lg font-bold">${(cluster.revenueMTD / 1000).toFixed(0)}K</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trend</p>
            <p className={cn("text-lg font-bold flex items-center gap-1", 
              cluster.trend > 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {cluster.trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {cluster.trend > 0 ? "+" : ""}{cluster.trend}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Open Risks</p>
            <p className={cn("text-lg font-bold", cluster.openRisks > 3 ? "text-amber-400" : "text-foreground")}>
              {cluster.openRisks}
            </p>
          </div>
        </div>

        {/* Automation Coverage */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Automation Coverage</span>
            <span className="font-medium">{cluster.automationCoverage}%</span>
          </div>
          <Progress value={cluster.automationCoverage} className="h-2" />
        </div>

        {/* Action */}
        <Button variant="outline" className="w-full gap-2" disabled>
          View Cluster
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
