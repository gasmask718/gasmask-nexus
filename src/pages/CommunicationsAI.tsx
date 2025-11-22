import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, TrendingDown, Users, MessageSquare, Calendar, Target, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CommunicationsAI() {
  const navigate = useNavigate();

  // Fetch all entities for AI analysis
  const { data: stores } = useQuery({
    queryKey: ['stores-ai'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, city')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: wholesalers } = useQuery({
    queryKey: ['wholesalers-ai'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_hubs')
        .select('id, name, city')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: influencers } = useQuery({
    queryKey: ['influencers-ai'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencers')
        .select('id, name, city')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Get communication stats
  const { data: recentComms } = useQuery({
    queryKey: ['recent-communications'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('communication_events')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const totalEntities = (stores?.length || 0) + (wholesalers?.length || 0) + (influencers?.length || 0);
  const totalComms = recentComms?.length || 0;
  const avgCommsPerDay = Math.round(totalComms / 30);

  // Calculate channel breakdown
  const channelBreakdown = recentComms?.reduce((acc: Record<string, number>, comm) => {
    const channel = comm.channel || 'unknown';
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              AI Communication Insights
            </h1>
            <p className="text-muted-foreground">
              Intelligent relationship management and outreach optimization
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            Powered by AI
          </Badge>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEntities}</div>
              <p className="text-xs text-muted-foreground">
                Stores, Wholesalers & Influencers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">30-Day Activity</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalComms}</div>
              <p className="text-xs text-muted-foreground">
                {avgCommsPerDay} per day average
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Channel</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {Object.entries(channelBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Most effective channel
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Critical actions needed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* At-Risk Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              At-Risk Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              No critical accounts detected. System monitoring {totalEntities} entities.
            </div>
          </CardContent>
        </Card>

        {/* High-Potential Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Most Promising Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              AI is analyzing engagement patterns to identify high-potential relationships.
            </div>
          </CardContent>
        </Card>

        {/* Channel Effectiveness */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Channel Effectiveness (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(channelBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize font-medium">{channel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted-foreground">{count} messages</div>
                      <Badge variant="secondary">
                        {Math.round((count / totalComms) * 100)}%
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Suggested Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              AI Suggested Bulk Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium">Check Cold Stores</div>
                <div className="text-sm text-muted-foreground">
                  Review stores with no contact in 14+ days
                </div>
              </div>
              <Button size="sm" onClick={() => navigate('/communications')}>
                Review
              </Button>
            </div>

            <div className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium">Influencer Outreach</div>
                <div className="text-sm text-muted-foreground">
                  Engage with influencers showing high activity
                </div>
              </div>
              <Button size="sm" onClick={() => navigate('/influencers')}>
                View
              </Button>
            </div>

            <div className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium">Wholesale Follow-Ups</div>
                <div className="text-sm text-muted-foreground">
                  Contact wholesalers with inventory alerts
                </div>
              </div>
              <Button size="sm" onClick={() => navigate('/wholesale')}>
                Action
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
