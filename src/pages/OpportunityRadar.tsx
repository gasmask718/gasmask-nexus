import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function OpportunityRadar() {
  const navigate = useNavigate();

  const { data: storesNeedingVisit, isLoading: storesLoading } = useQuery({
    queryKey: ['stores-needing-visit'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('optimization', {
        body: { action: 'getTopStoresNeedingVisit', limit: 10 }
      });
      if (error) throw error;
      return data.stores;
    },
  });

  const { data: expansionClusters } = useQuery({
    queryKey: ['expansion-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('optimization', {
        body: { action: 'getExpansionClusters' }
      });
      if (error) throw error;
      return data.clusters;
    },
  });

  const { data: recommendedInfluencers } = useQuery({
    queryKey: ['recommended-influencers'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('optimization', {
        body: { action: 'recommendInfluencers', limit: 8 }
      });
      if (error) throw error;
      return data.influencers;
    },
  });

  const getUrgencyColor = (score: number) => {
    if (score >= 70) return "text-destructive bg-destructive/10 border-destructive/20";
    if (score >= 40) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    return "text-blue-500 bg-blue-500/10 border-blue-500/20";
  };

  if (storesLoading) {
    return <div className="p-8 text-center">Analyzing opportunities...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Opportunity Radar</h1>
          <p className="text-muted-foreground">AI-powered recommendations for maximum impact</p>
        </div>

        {/* Stores Needing Love */}
        <Card className="p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <h2 className="text-2xl font-bold">Stores Needing Love</h2>
            </div>
            <Badge variant="outline">{storesNeedingVisit?.length || 0} urgent</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {storesNeedingVisit?.map((store: any) => (
              <Card key={store.id} className="p-4 border-border/50 hover:border-primary/50 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{store.name}</h3>
                    <div className="text-sm text-muted-foreground">{store.address_city}</div>
                  </div>
                  <Badge className={getUrgencyColor(store.urgencyScore)}>
                    Score: {store.urgencyScore}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{store.daysSinceVisit === 999 ? 'Never visited' : `${store.daysSinceVisit} days since visit`}</span>
                </div>

                <Badge variant="outline">{store.status}</Badge>

                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/stores/${store.id}`)}
                  >
                    Open Store
                  </Button>
                  <Button size="sm" className="flex-1">
                    Add to Route
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* Expansion Clusters */}
        <Card className="p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Expansion Clusters</h2>
            </div>
            <Badge variant="outline">{expansionClusters?.length || 0} territories</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {expansionClusters?.slice(0, 6).map((cluster: any) => (
              <Card key={cluster.city} className="p-6 border-border/50 hover:border-primary/50 transition-all">
                <h3 className="font-bold text-xl mb-2">{cluster.city}</h3>
                <div className="text-3xl font-bold text-primary mb-3">{cluster.count}</div>
                <div className="text-sm text-muted-foreground mb-4">prospect stores</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/map?city=${cluster.city}`)}
                >
                  Open on Map
                </Button>
              </Card>
            ))}
          </div>
        </Card>

        {/* Influencer Targets */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Influencer Targets</h2>
            </div>
            <Badge variant="outline">{recommendedInfluencers?.length || 0} recommended</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendedInfluencers?.map((influencer: any) => (
              <Card key={influencer.id} className="p-4 border-border/50 hover:border-primary/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-muted-foreground">@{influencer.username}</span>
                  <Badge variant="outline" className="text-xs">
                    {influencer.recommendationScore}
                  </Badge>
                </div>
                <h3 className="font-bold mb-1">{influencer.name}</h3>
                <div className="text-sm text-muted-foreground mb-2">{influencer.city}</div>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span>{influencer.followers.toLocaleString()} followers</span>
                  <span>{influencer.engagement_rate}% eng.</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/influencers')}
                >
                  View Profile
                </Button>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}