import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Instagram, Mail, Phone, MapPin, TrendingUp, MessageSquare } from "lucide-react";
import { CommunicationTimeline } from "@/components/CommunicationTimeline";
import { CommunicationStats } from "@/components/communication/CommunicationStats";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";
import { FollowUpInsights } from "@/components/communication/FollowUpInsights";
import { useState } from "react";

export default function InfluencerDetail() {
  const { id } = useParams();
  const [logModalOpen, setLogModalOpen] = useState(false);

  const { data: influencer, isLoading } = useQuery({
    queryKey: ['influencer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-muted-foreground">Loading influencer...</div>
        </div>
      </Layout>
    );
  }

  if (!influencer) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Influencer not found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{influencer.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Instagram className="h-4 w-4" />
              <span>@{influencer.username}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setLogModalOpen(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Log Communication
            </Button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Followers</div>
            <div className="text-2xl font-bold">
              {influencer.followers.toLocaleString()}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Engagement Rate</div>
            <div className="text-2xl font-bold">{influencer.engagement_rate}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Score</div>
            <div className="text-2xl font-bold">{influencer.score}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Status</div>
            <Badge variant={influencer.status === 'active' ? 'default' : 'secondary'}>
              {influencer.status}
            </Badge>
          </Card>
        </div>

        {/* Contact Info */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {influencer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{influencer.email}</span>
              </div>
            )}
            {influencer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{influencer.phone}</span>
              </div>
            )}
            {influencer.city && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{influencer.city}</span>
              </div>
            )}
            {influencer.niche && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">{influencer.niche}</Badge>
              </div>
            )}
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="communication" className="space-y-6">
          <TabsList>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="communication" className="space-y-6">
            <CommunicationStats entityType="influencer" entityId={id!} />
            <FollowUpInsights entityType="influencer" entityId={id!} />
            <CommunicationTimeline entityType="influencer" entityId={id!} />
          </TabsContent>

          <TabsContent value="campaigns">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Campaign tracking coming soon
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Performance insights coming soon
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <CommunicationLogModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        entityType="influencer"
        entityId={id!}
        entityName={influencer.name}
        onSuccess={() => setLogModalOpen(false)}
      />
    </Layout>
  );
}
