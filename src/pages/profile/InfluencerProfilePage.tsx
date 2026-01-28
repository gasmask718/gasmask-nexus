/**
 * InfluencerProfilePage - Influencer / Street Team Profile
 * Route: /profile/influencer/:id
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Megaphone, MapPin, Calendar, Phone, Mail, TrendingUp, DollarSign,
  User, AlertTriangle, Instagram, Youtube, Globe, Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProfileLayout, ProfileStatCard, ProfileNotesTab, ProfileNote } from '@/components/profile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClickablePhone } from '@/components/communication/ClickablePhone';

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Globe,
  twitter: Globe,
  facebook: Globe,
  street_team: Users,
  other: Globe,
};

export default function InfluencerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch influencer profile
  const profileQuery = useQuery({
    queryKey: ['influencer-profile-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch assigned ambassador
  const assignmentQuery = useQuery({
    queryKey: ['influencer-ambassador', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('influencer_assignments')
        .select(`
          *,
          ambassador:ambassador_id (id, name, city, phone_primary)
        `)
        .eq('influencer_id', id)
        .eq('active', true)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch campaigns/activations
  const campaignsQuery = useQuery({
    queryKey: ['influencer-campaigns', id],
    queryFn: async () => {
      if (!id) return { count: 0, data: [] };
      const { data, error, count } = await (supabase as any)
        .from('influencer_campaigns')
        .select('*', { count: 'exact' })
        .eq('influencer_id', id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error && error.code !== 'PGRST116') {
        // Table might not exist
        return { count: 0, data: [] };
      }
      return { count: count || 0, data: data || [] };
    },
    enabled: !!id,
  });

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading;

  if (!profile && !isLoading) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Influencer Not Found</h2>
        <Button onClick={() => navigate('/influencers')}>Back to Influencers</Button>
      </div>
    );
  }

  const displayName = profile?.name || 'Influencer';
  const PlatformIcon = platformIcons[profile?.platform || 'other'] || Globe;

  // Build tabs
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile?.username && (
                <div className="flex items-center gap-2">
                  <PlatformIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">@{profile.username}</span>
                </div>
              )}
              {profile?.platform && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{profile.platform}</Badge>
                </div>
              )}
              {profile?.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.city}</span>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <ClickablePhone 
                    phone={profile.phone} 
                    entityType="other"
                    entityId={id!}
                    entityName={displayName}
                  />
                </div>
              )}
              {profile?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.email}</span>
                </div>
              )}
              {profile?.niche && (
                <Badge variant="secondary">{profile.niche}</Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assigned Ambassador</CardTitle>
            </CardHeader>
            <CardContent>
              {assignmentQuery.data?.ambassador ? (
                <Link 
                  to={`/profile/ambassador/${assignmentQuery.data.ambassador.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <User className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{assignmentQuery.data.ambassador.name}</p>
                    <p className="text-sm text-muted-foreground">{assignmentQuery.data.ambassador.city}</p>
                  </div>
                </Link>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No ambassador assigned</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      count: campaignsQuery.data?.count || 0,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Campaigns & Activations</CardTitle>
            <CardDescription>Marketing campaigns this influencer participated in</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {campaignsQuery.data?.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No campaigns yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaignsQuery.data?.data.map((campaign: any) => (
                    <div 
                      key={campaign.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border"
                    >
                      <div>
                        <p className="font-medium">{campaign.name || 'Campaign'}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                        {campaign.status || 'pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'performance',
      label: 'Performance',
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Engagement and reach data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{profile?.followers?.toLocaleString() || '--'}</p>
                <p className="text-sm text-muted-foreground">Followers</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{profile?.engagement_rate ? `${profile.engagement_rate}%` : '--'}</p>
                <p className="text-sm text-muted-foreground">Engagement Rate</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{campaignsQuery.data?.count || 0}</p>
                <p className="text-sm text-muted-foreground">Campaigns</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">--</p>
                <p className="text-sm text-muted-foreground">Total Payouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'payouts',
      label: 'Payouts',
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
            <CardDescription>Payments for campaigns and activations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No payout history available</p>
            </div>
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <ProfileLayout
        isLoading={isLoading}
        backPath="/influencers"
        backLabel="Back to Influencers"
        header={{
          icon: <Megaphone className="h-6 w-6 text-primary" />,
          title: displayName,
          subtitle: profile?.username ? `@${profile.username}` : 'Influencer / Street Team',
          status: {
            label: profile?.status || 'active',
            variant: profile?.status === 'active' ? 'default' : 'secondary',
          },
          badges: [
            ...(profile?.platform ? [{ label: profile.platform, variant: 'outline' as const }] : []),
            ...(profile?.niche ? [{ label: profile.niche, variant: 'secondary' as const }] : []),
          ],
          metadata: [
            ...(profile?.city ? [{ icon: <MapPin className="h-4 w-4" />, label: profile.city }] : []),
            ...(profile?.created_at ? [{ icon: <Calendar className="h-4 w-4" />, label: `Since ${format(new Date(profile.created_at), 'MMM yyyy')}` }] : []),
          ],
        }}
        stats={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ProfileStatCard
              icon={<Users className="h-5 w-5 text-primary" />}
              iconClassName="bg-primary/10"
              value={profile?.followers?.toLocaleString() || '--'}
              label="Followers"
            />
            <ProfileStatCard
              icon={<TrendingUp className="h-5 w-5 text-green-500" />}
              iconClassName="bg-green-500/10"
              value={profile?.engagement_rate ? `${profile.engagement_rate}%` : '--'}
              label="Engagement"
            />
            <ProfileStatCard
              icon={<Megaphone className="h-5 w-5 text-purple-500" />}
              iconClassName="bg-purple-500/10"
              value={campaignsQuery.data?.count || 0}
              label="Campaigns"
            />
            <ProfileStatCard
              icon={<DollarSign className="h-5 w-5 text-blue-500" />}
              iconClassName="bg-blue-500/10"
              value="--"
              label="Total Payouts"
            />
          </div>
        }
        tabs={tabs}
        onAddNote={() => {}}
      />
  );
}
