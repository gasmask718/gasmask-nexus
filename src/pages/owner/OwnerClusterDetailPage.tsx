import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Building2, TrendingUp, AlertTriangle, Zap, Brain } from 'lucide-react';

const clusterData: Record<string, { name: string; businesses: string[]; revenueMTD: number; trend: number; openRisks: number; automationCoverage: number }> = {
  transport: { name: 'Transport & Logistics Cluster', businesses: ['GasMask Distribution', 'Grabba R Us Delivery', 'BikerFleet'], revenueMTD: 185000, trend: 12, openRisks: 3, automationCoverage: 78 },
  events: { name: 'Events & Experiences Cluster', businesses: ['TopTier Experience', 'Unforgettable Times'], revenueMTD: 91000, trend: 18, openRisks: 2, automationCoverage: 65 },
  adult: { name: 'Adult Entertainment Cluster', businesses: ['PlayBoxxx'], revenueMTD: 77000, trend: 25, openRisks: 1, automationCoverage: 82 },
  tobacco: { name: 'Tobacco & Lifestyle Cluster', businesses: ['GasMask', 'HotMama', 'Hot Scalati', 'Grabba R Us'], revenueMTD: 193000, trend: 10, openRisks: 5, automationCoverage: 88 },
  services: { name: 'Services Cluster', businesses: ['iClean WeClean'], revenueMTD: 22000, trend: 7, openRisks: 1, automationCoverage: 45 },
  finance: { name: 'Finance & Wealth Cluster', businesses: ['Funding Company', 'Grant Company', 'Wealth Engine'], revenueMTD: 76000, trend: 15, openRisks: 4, automationCoverage: 72 },
};

export default function OwnerClusterDetailPage() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const navigate = useNavigate();
  
  const cluster = clusterId ? clusterData[clusterId] : null;
  
  if (!cluster) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Cluster not found</p>
        <Button variant="outline" onClick={() => navigate('/os/owner/cluster')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clusters
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/cluster')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30">
            <Building2 className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{cluster.name}</h1>
            <p className="text-sm text-muted-foreground">Cluster ID: {clusterId}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue MTD</p>
                <p className="text-2xl font-bold">${(cluster.revenueMTD / 1000).toFixed(0)}K</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <p className="text-2xl font-bold text-emerald-400">+{cluster.trend}%</p>
              </div>
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Risks</p>
                <p className="text-2xl font-bold">{cluster.openRisks}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Automation</p>
                <p className="text-2xl font-bold">{cluster.automationCoverage}%</p>
              </div>
              <Zap className="h-5 w-5 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Businesses in Cluster */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Businesses in Cluster</CardTitle>
          <CardDescription className="text-xs">{cluster.businesses.length} businesses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cluster.businesses.map((business, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                <span className="text-sm font-medium">{business}</span>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Automation Coverage */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Automation Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={cluster.automationCoverage} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">{cluster.automationCoverage}% of key processes automated</p>
        </CardContent>
      </Card>

      {/* AI Note */}
      <Card className="rounded-xl border-purple-500/30 bg-gradient-to-br from-purple-950/30 to-purple-900/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            AI Note
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            In future, this will summarize cluster health with real AI analysis, including revenue forecasts, 
            risk mitigation suggestions, and automation optimization recommendations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
