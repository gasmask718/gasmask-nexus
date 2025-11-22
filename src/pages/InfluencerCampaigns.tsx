import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, DollarSign, Eye } from "lucide-react";

export default function InfluencerCampaigns() {
  const { data: campaigns } = useQuery({
    queryKey: ['influencer-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencer_campaigns')
        .select(`
          *,
          influencer_campaign_participants(count),
          influencer_posts(count),
          influencer_conversions(count, value)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: 'bg-muted text-muted-foreground',
      active: 'bg-accent text-accent-foreground',
      completed: 'bg-primary/20 text-primary',
      paused: 'bg-destructive/20 text-destructive',
    };
    return colors[status] || 'bg-muted';
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Influencer Campaigns</h1>
          <p className="text-muted-foreground">Track performance and manage influencer partnerships</p>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-md">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="planning">Planning</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          {['active', 'planning', 'completed', 'all'].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {campaigns
                  ?.filter((c) => tab === 'all' || c.status === tab)
                  .map((campaign) => (
                    <Card key={campaign.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{campaign.name}</CardTitle>
                          <Badge className={getStatusColor(campaign.status)}>
                            {campaign.status}
                          </Badge>
                        </div>
                        {campaign.objective && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {campaign.objective}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-2xl font-bold">
                                {campaign.influencer_campaign_participants?.[0]?.count || 0}
                              </p>
                              <p className="text-xs text-muted-foreground">Influencers</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-2xl font-bold">
                                {campaign.influencer_posts?.[0]?.count || 0}
                              </p>
                              <p className="text-xs text-muted-foreground">Posts</p>
                            </div>
                          </div>
                        </div>

                        {campaign.expected_reach && (
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              Expected Reach: {campaign.expected_reach.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {campaign.budget && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              Budget: ${campaign.budget.toLocaleString()}
                            </span>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          {campaign.start_date && campaign.end_date && (
                            <p>
                              {new Date(campaign.start_date).toLocaleDateString()} -{' '}
                              {new Date(campaign.end_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>

              {(!campaigns || campaigns.filter((c) => tab === 'all' || c.status === tab).length === 0) && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No campaigns found</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
