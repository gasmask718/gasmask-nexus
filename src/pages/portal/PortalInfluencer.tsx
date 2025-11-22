import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, TrendingUp, DollarSign, Users, Calendar, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PortalInfluencer() {
  const [influencerData, setInfluencerData] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchInfluencerData();
  }, []);

  async function fetchInfluencerData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Simplified query to avoid type issues
      const influencerResponse: any = await supabase
        .from('influencers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (influencerResponse.data) {
        setInfluencerData(influencerResponse.data);

        const campaignsResponse: any = await supabase
          .from('influencer_campaign_participants')
          .select('*')
          .eq('influencer_id', influencerResponse.data.id);

        setCampaigns(campaignsResponse.data || []);
      }
    } catch (error) {
      console.error('Error fetching influencer data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load influencer data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!influencerData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Influencer Profile Not Found</h2>
          <p className="text-muted-foreground mb-6">
            Complete your influencer profile to get started
          </p>
          <Button>Complete Profile</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{influencerData.name}</h1>
              <p className="text-muted-foreground">@{influencerData.username} • {influencerData.platform}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Followers</p>
                <p className="text-xl font-bold">{influencerData.followers.toLocaleString()}</p>
              </div>
              <Badge variant={influencerData.status === 'active' ? 'default' : 'secondary'}>
                {influencerData.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="links">Affiliate Links</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="content">Content Assistant</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-4">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Clicks</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Conversions</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-2xl font-bold">$0</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Calendar className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Active Campaigns</p>
                    <p className="text-2xl font-bold">{campaigns.length}</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Active Campaigns</h3>
              {campaigns.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active campaigns</p>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{campaign.influencer_campaigns?.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.role}</p>
                      </div>
                      <Badge>{campaign.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="links">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Your Affiliate Links</h3>
              <p className="text-muted-foreground mb-4">Share these links to earn commissions</p>
              <Button>
                <Link2 className="mr-2 h-4 w-4" />
                Generate New Link
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Campaign History</h3>
              {campaigns.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No campaigns yet</p>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((campaign) => (
                    <Card key={campaign.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{campaign.influencer_campaigns?.name}</h4>
                        <Badge>{campaign.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {campaign.influencer_campaigns?.objective}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="earnings">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Earnings History</h3>
              <p className="text-muted-foreground">Track your commissions and payouts</p>
            </Card>
          </TabsContent>

          <TabsContent value="content">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">AI Content Assistant</h3>
              <p className="text-muted-foreground mb-4">
                Generate social media content automatically
              </p>
              <Button>Generate Post Ideas</Button>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Profile Settings</h3>
              <p className="text-muted-foreground">Update your influencer profile</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
