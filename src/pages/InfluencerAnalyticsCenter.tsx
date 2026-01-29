import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInfluencerGlobalAnalytics } from "@/hooks/useInfluencerAnalytics";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Eye, 
  Heart, 
  TrendingUp, 
  Users, 
  Trophy,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  BarChart3,
  Target,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function InfluencerAnalyticsCenter() {
  const navigate = useNavigate();
  const { data: analytics, isLoading, refetch } = useInfluencerGlobalAnalytics();

  // Get influencer list for top performers
  const { data: influencers } = useQuery({
    queryKey: ['influencers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencers')
        .select('id, name, username, platform, followers, engagement_rate, status')
        .eq('status', 'active')
        .order('followers', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  // Get campaigns
  const { data: campaigns } = useQuery({
    queryKey: ['influencer-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencer_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-muted rounded w-64" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const totals = analytics?.totals || {
    total_exposures: 0,
    total_views: 0,
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
    post_count: 0,
  };

  const connectionHealth = analytics?.connectionHealth || {
    connected: 0,
    needs_reconnect: 0,
    disconnected: 0,
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              Influencer Analytics Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Global performance metrics across {analytics?.influencerCount || 0} influencers
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-sm">Total Exposures</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(totals.total_exposures)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-sm">Total Views</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(totals.total_views)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-sm">Total Likes</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(totals.total_likes)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm">Engagement</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(totals.total_comments + totals.total_shares)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Target className="h-4 w-4" />
                <span className="text-sm">Total Posts</span>
              </div>
              <p className="text-2xl font-bold">{totals.post_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">Influencers</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.influencerCount || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Connection Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Connection Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Connected</span>
                </div>
                <p className="text-3xl font-bold text-green-600">{connectionHealth.connected}</p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium">Needs Reconnect</span>
                </div>
                <p className="text-3xl font-bold text-yellow-600">{connectionHealth.needs_reconnect}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium">Disconnected</span>
                </div>
                <p className="text-3xl font-bold text-red-600">{connectionHealth.disconnected}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for detailed views */}
        <Tabs defaultValue="top-performers" className="space-y-6">
          <TabsList>
            <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
          </TabsList>

          <TabsContent value="top-performers">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Top Performing Influencers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!influencers || influencers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No influencers found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Influencer</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Followers</TableHead>
                        <TableHead className="text-right">Engagement</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {influencers.map((inf, index) => (
                        <TableRow 
                          key={inf.id} 
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => navigate(`/influencers/${inf.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold">
                              {index + 1}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{inf.name}</p>
                              <p className="text-sm text-muted-foreground">@{inf.username}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{inf.platform}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNumber(inf.followers)}
                          </TableCell>
                          <TableCell className="text-right">
                            {inf.engagement_rate}%
                          </TableCell>
                          <TableCell>
                            <Badge variant={inf.status === 'active' ? 'default' : 'secondary'}>
                              {inf.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                {!campaigns || campaigns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No campaigns found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Objective</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Expected Reach</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>
                            <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                              {campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{campaign.objective || 'Not specified'}</TableCell>
                          <TableCell className="text-right">
                            {campaign.budget ? `$${campaign.budget.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {campaign.expected_reach ? formatNumber(campaign.expected_reach) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="milestones">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Brand Exposure Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: '1M Exposures', value: 1000000, achieved: totals.total_exposures >= 1000000 },
                    { label: '10M Exposures', value: 10000000, achieved: totals.total_exposures >= 10000000 },
                    { label: '50M Exposures', value: 50000000, achieved: totals.total_exposures >= 50000000 },
                    { label: '100M Exposures', value: 100000000, achieved: totals.total_exposures >= 100000000 },
                  ].map((milestone) => {
                    const progress = Math.min(100, (totals.total_exposures / milestone.value) * 100);
                    
                    return (
                      <div 
                        key={milestone.label}
                        className={`p-4 rounded-lg border-2 ${
                          milestone.achieved 
                            ? 'border-yellow-500 bg-yellow-500/10' 
                            : 'border-muted bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Trophy className={`h-6 w-6 ${milestone.achieved ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                          {milestone.achieved && (
                            <Badge className="bg-yellow-500 text-black">Achieved!</Badge>
                          )}
                        </div>
                        <p className="font-semibold">{milestone.label}</p>
                        {!milestone.achieved && (
                          <div className="mt-2">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {progress.toFixed(1)}% complete
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}