import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Instagram, Mail, Phone, MapPin, TrendingUp, MessageSquare, BarChart3, Wallet, FileText, Users, Eye, AlertCircle } from "lucide-react";
import { CommunicationTimeline } from "@/components/CommunicationTimeline";
import { CommunicationStats } from "@/components/communication/CommunicationStats";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";
import { FollowUpInsights } from "@/components/communication/FollowUpInsights";
import { AIRelationshipHealth } from "@/components/communication/AIRelationshipHealth";
import { 
  InfluencerSocialAccounts, 
  InfluencerAnalyticsDashboard, 
  InfluencerContentTracker,
  InfluencerPayoutsPanel 
} from "@/components/influencer";
import { DebugOverlay } from "@/components/ui/DebugOverlay";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useState } from "react";
import { useInfluencerMetricsAggregate, useInfluencerSocialAccounts, useInfluencerPosts } from "@/hooks/useInfluencerAnalytics";

interface InfluencerDetailProps {
  isReadOnly?: boolean;
  viewerContext?: 'admin' | 'ambassador' | 'self';
}

export default function InfluencerDetail({ isReadOnly = false, viewerContext = 'self' }: InfluencerDetailProps) {
  const { id } = useParams();
  const [logModalOpen, setLogModalOpen] = useState(false);

  const { data: influencer, isLoading, error } = useQuery({
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

  // Fetch assigned ambassador
  const { data: assignment } = useQuery({
    queryKey: ['influencer-assignment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencer_assignments')
        .select(`
          *,
          ambassador:ambassadors(name, user_id)
        `)
        .eq('influencer_id', id)
        .eq('active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Get metrics for debug overlay
  const { data: metrics } = useInfluencerMetricsAggregate(id);
  const { data: socialAccounts } = useInfluencerSocialAccounts(id);
  const { data: posts } = useInfluencerPosts(id);

  // Determine if user is admin (for debug overlay)
  // TODO: Replace with actual role check
  const isAdmin = viewerContext === 'admin';
  const isEditable = !isReadOnly && viewerContext !== 'ambassador';

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded w-64" />
            <div className="h-6 bg-muted rounded w-48" />
          </div>
          <LoadingSkeleton variant="kpi-grid" count={4} />
          <LoadingSkeleton variant="card" count={2} />
        </div>
      </Layout>
    );
  }

  if (error || !influencer) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <EmptyState
            icon={AlertCircle}
            title="Influencer not found"
            description="The influencer you're looking for doesn't exist or you don't have access to view it."
            actionLabel="Go Back"
            onAction={() => window.history.back()}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Read-only banner */}
        {isReadOnly && (
          <Alert>
            <Eye className="h-4 w-4" />
            <AlertDescription>
              <strong>Viewing Influencer Profile for {influencer.name}</strong> — Read-only mode. 
              You can view all data but cannot make changes.
            </AlertDescription>
          </Alert>
        )}

        {/* Identity Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{influencer.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Instagram className="h-4 w-4" />
              <span>@{influencer.username}</span>
              {influencer.platform && (
                <Badge variant="outline" className="ml-2">{influencer.platform}</Badge>
              )}
            </div>
            {assignment?.ambassador && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Assigned to: {assignment.ambassador.name}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!isReadOnly && (
              <Button onClick={() => setLogModalOpen(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Log Communication
              </Button>
            )}
          </div>
        </div>

        {/* Info Cards - Clickable where relevant */}
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
            {influencer.email ? (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${influencer.email}`} className="text-primary hover:underline">
                  {influencer.email}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>No email provided</span>
              </div>
            )}
            {influencer.phone ? (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${influencer.phone}`} className="text-primary hover:underline">
                  {influencer.phone}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>No phone provided</span>
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
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="social" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Social Accounts
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="communication" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Communication
            </TabsTrigger>
            <TabsTrigger value="payouts" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Payouts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <InfluencerAnalyticsDashboard influencerId={id!} />
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <InfluencerSocialAccounts influencerId={id!} isEditable={isEditable} />
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <InfluencerContentTracker influencerId={id!} isEditable={isEditable} />
          </TabsContent>

          <TabsContent value="communication" className="space-y-6">
            <CommunicationStats entityType="influencer" entityId={id!} />
            <AIRelationshipHealth entityType="influencer" entityId={id!} />
            <FollowUpInsights entityType="influencer" entityId={id!} />
            <CommunicationTimeline entityType="influencer" entityId={id!} />
          </TabsContent>

          <TabsContent value="payouts" className="space-y-6">
            <InfluencerPayoutsPanel influencerId={id!} isEditable={isEditable} />
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

      {/* Debug Overlay - Admin Only */}
      <DebugOverlay
        entityType="Influencer"
        entityId={id}
        isAdmin={isAdmin}
        data={[
          { label: 'Status', value: influencer.status, type: 'status' },
          { label: 'Followers', value: influencer.followers, type: 'count' },
          { label: 'Posts Tracked', value: posts?.length || 0, type: 'count' },
          { label: 'Social Accounts', value: socialAccounts?.length || 0, type: 'count' },
          { label: 'Total Exposures', value: metrics?.total_exposures || 0, type: 'count' },
          { label: 'Assignment ID', value: assignment?.id || 'None', type: 'id' },
          { label: 'Ambassador', value: assignment?.ambassador?.name || 'Unassigned' },
        ]}
      />
    </Layout>
  );
}
