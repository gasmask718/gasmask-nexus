/**
 * InfluencerProfilePage - Full Intelligence Profile
 * Route: /profile/influencer/:id
 * 
 * Governance: Influencer profiles are used for coordination, attribution, and analytics only.
 * They are not employment records, disciplinary tools, or automated decision engines.
 */
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Megaphone, MapPin, Calendar, Phone, Mail, TrendingUp, DollarSign,
  User, AlertTriangle, Users, Globe, Clock, Shield, CreditCard,
  FileText, MessageCircle, BarChart3, Play, Link2, Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProfileLayout, ProfileStatCard, ProfileActivityPanel } from '@/components/profile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClickablePhone } from '@/components/communication/ClickablePhone';
import { SocialIdentitySection } from '@/components/influencer/SocialIdentitySection';
import { InfluencerAnalyticsDashboard } from '@/components/influencer/InfluencerAnalyticsDashboard';
import { InfluencerContentTracker } from '@/components/influencer/InfluencerContentTracker';
import { InfluencerPayoutsPanel } from '@/components/influencer/InfluencerPayoutsPanel';
import { InfluencerCommunicationPanel } from '@/components/influencer/InfluencerCommunicationPanel';
import { useUnifiedProfileView } from '@/hooks/useUnifiedProfileView';
import { OpsParticipationSummary } from '@/components/profile/OpsParticipationSummary';
import { InfluencerContactEdit } from '@/components/influencer/InfluencerContactEdit';
import { ProfileCompletenessScore, computeInfluencerCompleteness } from '@/components/profile/ProfileCompletenessScore';

export default function InfluencerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  const assignmentQuery = useQuery({
    queryKey: ['influencer-ambassador', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('influencer_assignments')
        .select(`*, ambassador:ambassador_id (id, name, city, phone_primary)`)
        .eq('influencer_id', id)
        .eq('active', true)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!id,
  });

  const campaignsQuery = useQuery({
    queryKey: ['influencer-campaign-participations', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await (supabase as any)
        .from('influencer_campaign_participants')
        .select(`*, campaign:campaign_id (id, name, objective, start_date, end_date, status)`)
        .eq('influencer_id', id)
        .order('created_at', { ascending: false });
      if (error && error.code !== 'PGRST116') return [];
      return data || [];
    },
    enabled: !!id,
  });

  const payoutsTotalQuery = useQuery({
    queryKey: ['influencer-payouts-total', id],
    queryFn: async () => {
      if (!id) return 0;
      const { data, error } = await supabase
        .from('influencer_payouts')
        .select('amount, status')
        .eq('influencer_id', id)
        .eq('status', 'paid');
      if (error) return 0;
      return data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    },
    enabled: !!id,
  });

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading;

  const unifiedProfile = useUnifiedProfileView({
    userId: profile?.created_by,
    role: 'influencer',
    displayName: profile?.name || 'Influencer',
    status: profile?.status || 'active',
    joinedAt: profile?.created_at || null,
    phone: profile?.phone,
    email: profile?.email,
    dateOfBirth: profile?.date_of_birth,
    neighborhood: profile?.neighborhood,
    territory: profile?.city,
  });

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
  const campaigns = campaignsQuery.data || [];
  const totalPaid = payoutsTotalQuery.data || 0;

  const onboardingColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-600',
    verified: 'bg-blue-500/20 text-blue-600',
    approved: 'bg-green-500/20 text-green-600',
  };

  const influencerCompleteness = computeInfluencerCompleteness(profile);

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {/* Governance Banner */}
          <Alert className="border-blue-500/30 bg-blue-500/5">
            <Shield className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-sm text-muted-foreground">
              Influencer profiles are used for coordination, attribution, and analytics only.
              They are not employment records, disciplinary tools, or automated decision engines.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Contact Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact & Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile?.legal_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Legal:</span>
                    <span className="font-medium">{profile.legal_name}</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-2 text-sm">
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
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.email}</span>
                  </div>
                )}
                {(profile?.neighborhood || profile?.city) && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[profile.neighborhood, profile.city, profile.state, profile.country]
                        .filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {unifiedProfile.contact.dateOfBirthMasked && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Born:</span>
                    <span className="font-medium">{unifiedProfile.contact.dateOfBirthMasked}</span>
                  </div>
                )}
                {profile?.timezone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.timezone}</span>
                  </div>
                )}
                {profile?.niche && (
                  <Badge variant="secondary">{profile.niche}</Badge>
                )}
              </CardContent>
            </Card>

            {/* Ambassador & Ops Status */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Assigned Ambassador</CardTitle>
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Ops Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Onboarding</span>
                    <Badge variant="outline" className={onboardingColors[profile?.onboarding_status || 'pending']}>
                      {profile?.onboarding_status || 'pending'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Payment Method</span>
                    <Badge variant="outline" className={profile?.payment_method_on_file ? 'text-green-600' : 'text-yellow-600'}>
                      <CreditCard className="h-3 w-3 mr-1" />
                      {profile?.payment_method_on_file ? 'On File' : 'Missing'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tax Form</span>
                    <Badge variant="outline">
                      <FileText className="h-3 w-3 mr-1" />
                      {profile?.tax_form_status || 'not_required'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Preferred Contact</span>
                    <Badge variant="outline">
                      {profile?.preferred_contact_method || 'sms'}
                    </Badge>
                  </div>
                  {profile?.last_contacted_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Contact</span>
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(profile.last_contacted_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'contact',
      label: 'Contact',
      content: (
        <div className="space-y-4">
          <ProfileCompletenessScore score={influencerCompleteness.score} missingFields={influencerCompleteness.missingFields} />
          <InfluencerContactEdit influencerId={id!} influencer={profile} isEditable={true} />
        </div>
      ),
    },
    {
      id: 'social',
      label: 'Social',
      content: <SocialIdentitySection influencerId={id!} isEditable={true} />,
    },
    {
      id: 'content',
      label: 'Content',
      content: <InfluencerContentTracker influencerId={id!} isEditable={true} />,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      content: <InfluencerAnalyticsDashboard influencerId={id!} />,
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      count: campaigns.length,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Participation</CardTitle>
            <CardDescription>Brand campaigns and deliverable tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {campaigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No campaign participation yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((p: any) => (
                    <div key={p.id} className="p-4 rounded-lg bg-muted/30 border space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{p.campaign?.name || 'Campaign'}</p>
                        <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                          {p.status}
                        </Badge>
                      </div>
                      {p.campaign?.objective && (
                        <p className="text-sm text-muted-foreground">{p.campaign.objective}</p>
                      )}
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <Badge variant="outline" className="capitalize">{p.role}</Badge>
                        {p.agreed_rate && <span>${Number(p.agreed_rate).toLocaleString()} rate</span>}
                        {p.campaign?.start_date && (
                          <span>{format(new Date(p.campaign.start_date), 'MMM d, yyyy')} → {p.campaign.end_date ? format(new Date(p.campaign.end_date), 'MMM d, yyyy') : 'Ongoing'}</span>
                        )}
                      </div>
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
      id: 'ops',
      label: 'Ops',
      content: (
        <div className="space-y-6">
          <OpsParticipationSummary
            data={unifiedProfile.opsParticipation}
            isLoading={unifiedProfile.isLoading}
            entityName={displayName}
          />
          <ProfileActivityPanel
            userId={profile?.created_by || null}
            entityName={displayName}
          />
        </div>
      ),
    },
    {
      id: 'payouts',
      label: 'Payouts',
      content: <InfluencerPayoutsPanel influencerId={id!} isEditable={true} />,
    },
    {
      id: 'comms',
      label: 'Comms',
      content: (
        <InfluencerCommunicationPanel
          influencerId={id!}
          influencerName={displayName}
          isEditable={true}
        />
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
        subtitle: profile?.username ? `@${profile.username}` : 'Creator / Street Team',
        status: {
          label: profile?.status || 'active',
          variant: profile?.status === 'active' ? 'default' : 'secondary',
        },
        badges: [
          ...(profile?.platform ? [{ label: profile.platform, variant: 'outline' as const }] : []),
          ...(profile?.niche ? [{ label: profile.niche, variant: 'secondary' as const }] : []),
          ...(profile?.onboarding_status ? [{ 
            label: profile.onboarding_status, 
            variant: (profile.onboarding_status === 'approved' ? 'default' : 'secondary') as 'default' | 'secondary'
          }] : []),
        ],
        metadata: [
          ...(profile?.city ? [{ icon: <MapPin className="h-4 w-4" />, label: [profile.neighborhood, profile.city].filter(Boolean).join(', ') }] : []),
          ...(profile?.timezone ? [{ icon: <Globe className="h-4 w-4" />, label: profile.timezone }] : []),
          ...(profile?.created_at ? [{ icon: <Calendar className="h-4 w-4" />, label: `Since ${format(new Date(profile.created_at), 'MMM yyyy')}` }] : []),
        ],
      }}
      stats={
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            value={campaigns.length}
            label="Campaigns"
          />
          <ProfileStatCard
            icon={<DollarSign className="h-5 w-5 text-blue-500" />}
            iconClassName="bg-blue-500/10"
            value={totalPaid > 0 ? `$${totalPaid.toLocaleString()}` : '--'}
            label="Total Paid"
          />
          <ProfileStatCard
            icon={<BarChart3 className="h-5 w-5 text-orange-500" />}
            iconClassName="bg-orange-500/10"
            value={profile?.influencer_health_score ?? '--'}
            label="Health Score"
          />
        </div>
      }
      tabs={tabs}
      onAddNote={() => {}}
    />
  );
}
