import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Instagram, Mail, Phone, MapPin, TrendingUp, MessageSquare, BarChart3, Wallet, FileText, Users, Eye, AlertCircle, Pencil, Save, X, Loader2 } from "lucide-react";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";
import { 
  InfluencerSocialAccounts, 
  InfluencerAnalyticsDashboard, 
  InfluencerContentTracker,
  InfluencerPayoutsPanel 
} from "@/components/influencer";
import { InfluencerCommunicationPanel } from "@/components/influencer/InfluencerCommunicationPanel";
import { SocialIdentitySection } from "@/components/influencer/SocialIdentitySection";
import { DebugOverlay } from "@/components/ui/DebugOverlay";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useState, useEffect } from "react";
import { useInfluencerMetricsAggregate, useInfluencerSocialAccounts, useInfluencerPosts } from "@/hooks/useInfluencerAnalytics";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface InfluencerDetailProps {
  isReadOnly?: boolean;
  viewerContext?: 'admin' | 'ambassador' | 'self';
}

export default function InfluencerDetail({ isReadOnly = false, viewerContext = 'self' }: InfluencerDetailProps) {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("analytics");
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    email: '',
    phone: '',
    city: '',
    niche: '',
    date_of_birth: '',
  });

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

  // Sync form state from influencer data
  useEffect(() => {
    if (influencer) {
      setContactForm({
        email: influencer.email || '',
        phone: influencer.phone || '',
        city: influencer.city || '',
        niche: influencer.niche || '',
        date_of_birth: influencer.date_of_birth || '',
      });
    }
  }, [influencer]);

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

  const isAdmin = viewerContext === 'admin';
  const isEditable = !isReadOnly && viewerContext !== 'ambassador';

  const saveContactMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('influencers')
        .update({
          email: contactForm.email.trim() || null,
          phone: contactForm.phone.trim() || null,
          city: contactForm.city.trim() || null,
          niche: contactForm.niche.trim() || null,
          date_of_birth: contactForm.date_of_birth || null,
          profile_last_updated_at: new Date().toISOString(),
          profile_last_updated_by: user?.id || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influencer', id] });
      toast.success('Contact info updated');
      setIsEditingContact(false);
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
  });

  const cancelEdit = () => {
    setIsEditingContact(false);
    if (influencer) {
      setContactForm({
        email: influencer.email || '',
        phone: influencer.phone || '',
        city: influencer.city || '',
        niche: influencer.niche || '',
        date_of_birth: influencer.date_of_birth || '',
      });
    }
  };

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
            {isEditable && !isEditingContact && (
              <Button variant="outline" onClick={() => setIsEditingContact(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
            {isEditingContact && (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => saveContactMutation.mutate()} 
                  disabled={saveContactMutation.isPending}
                >
                  {saveContactMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save
                </Button>
              </>
            )}
            {!isReadOnly && (
              <Button onClick={() => setLogModalOpen(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Log Communication
              </Button>
            )}
          </div>
        </div>

        {/* Metrics Row */}
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

        {/* Inline Contact Block — Part of Header Identity */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {/* Email */}
          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </span>
            {isEditingContact ? (
              <Input 
                type="email"
                value={contactForm.email} 
                onChange={(e) => setContactForm(p => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                className="h-8 text-sm"
              />
            ) : (
              <p className="font-medium text-foreground">
                {influencer.email ? (
                  <a href={`mailto:${influencer.email}`} className="text-primary hover:underline">{influencer.email}</a>
                ) : <span className="text-muted-foreground">—</span>}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Phone
            </span>
            {isEditingContact ? (
              <Input 
                value={contactForm.phone} 
                onChange={(e) => setContactForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+1 (555) 123-4567"
                className="h-8 text-sm"
              />
            ) : (
              <p className="font-medium text-foreground">
                {influencer.phone ? (
                  <a href={`tel:${influencer.phone}`} className="text-primary hover:underline">{influencer.phone}</a>
                ) : <span className="text-muted-foreground">—</span>}
              </p>
            )}
          </div>

          {/* City */}
          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> City
            </span>
            {isEditingContact ? (
              <Input 
                value={contactForm.city} 
                onChange={(e) => setContactForm(p => ({ ...p, city: e.target.value }))}
                placeholder="City"
                className="h-8 text-sm"
              />
            ) : (
              <p className="font-medium text-foreground">{influencer.city || <span className="text-muted-foreground">—</span>}</p>
            )}
          </div>

          {/* Niche */}
          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Niche
            </span>
            {isEditingContact ? (
              <Input 
                value={contactForm.niche} 
                onChange={(e) => setContactForm(p => ({ ...p, niche: e.target.value }))}
                placeholder="Niche"
                className="h-8 text-sm"
              />
            ) : (
              <p className="font-medium text-foreground">
                {influencer.niche ? <Badge variant="outline">{influencer.niche}</Badge> : <span className="text-muted-foreground">—</span>}
              </p>
            )}
          </div>
        </div>

        {/* Social Identity Section */}
        <SocialIdentitySection 
          influencerId={id!} 
          isEditable={isEditable}
        />

        {/* Tabs — no Contact tab */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
            <InfluencerCommunicationPanel
              influencerId={id!}
              influencerName={influencer.name}
              isEditable={!isReadOnly}
            />
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
