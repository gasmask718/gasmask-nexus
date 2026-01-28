/**
 * AmbassadorProfilePage - Ambassador Profile with connected portfolio tabs
 * Route: /profile/ambassador/:id
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  User, MapPin, Calendar, Phone, Mail, Star, DollarSign,
  Store, Users, Megaphone, TrendingUp, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProfileLayout, ProfileStatCard, ProfileNotesTab, ProfileNote } from '@/components/profile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEntityNotes } from '@/hooks/useEntityNotes';
import { ClickablePhone } from '@/components/communication/ClickablePhone';
import Layout from '@/components/Layout';

export default function AmbassadorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch ambassador profile
  const profileQuery = useQuery({
    queryKey: ['ambassador-profile-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('ambassadors')
        .select(`
          *,
          profiles:user_id (name, avatar_url, email)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch assigned stores count
  const storesQuery = useQuery({
    queryKey: ['ambassador-stores-count', id],
    queryFn: async () => {
      if (!id) return { count: 0, data: [] };
      const { data, error, count } = await (supabase as any)
        .from('store_assignments')
        .select('*, store:store_id (id, store_name, city, neighborhood)', { count: 'exact' })
        .eq('ambassador_id', id)
        .eq('active', true)
        .limit(10);
      if (error) throw error;
      return { count: count || 0, data: data || [] };
    },
    enabled: !!id,
  });

  // Fetch assigned wholesalers count
  const wholesalersQuery = useQuery({
    queryKey: ['ambassador-wholesalers-count', id],
    queryFn: async () => {
      if (!id) return { count: 0, data: [] };
      const { data, error, count } = await (supabase as any)
        .from('wholesaler_assignments')
        .select('*, wholesaler:wholesaler_id (id, name, city, state)', { count: 'exact' })
        .eq('ambassador_id', id)
        .eq('active', true)
        .limit(10);
      if (error) throw error;
      return { count: count || 0, data: data || [] };
    },
    enabled: !!id,
  });

  // Fetch recruited ambassadors count
  const recruitsQuery = useQuery({
    queryKey: ['ambassador-recruits-count', id],
    queryFn: async () => {
      if (!id) return { count: 0, data: [] };
      const { data, error, count } = await supabase
        .from('ambassadors')
        .select('id, name, city, tier, is_active', { count: 'exact' })
        .eq('recruited_by_ambassador_id', id)
        .limit(10);
      if (error) throw error;
      return { count: count || 0, data: data || [] };
    },
    enabled: !!id,
  });

  // Fetch assigned influencers count
  const influencersQuery = useQuery({
    queryKey: ['ambassador-influencers-count', id],
    queryFn: async () => {
      if (!id) return { count: 0, data: [] };
      const { data, error, count } = await (supabase as any)
        .from('influencer_assignments')
        .select('*, influencer:influencer_id (id, name, platform, city)', { count: 'exact' })
        .eq('ambassador_id', id)
        .eq('active', true)
        .limit(10);
      if (error) throw error;
      return { count: count || 0, data: data || [] };
    },
    enabled: !!id,
  });

  // Notes hook
  const notesHook = useEntityNotes('ambassador', id);

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading;

  if (!profile && !isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Ambassador Not Found</h2>
          <Button onClick={() => navigate('/ambassadors')}>Back to Ambassadors</Button>
        </div>
      </Layout>
    );
  }

  const displayName = profile?.name || profile?.profiles?.name || 'Ambassador';
  const territory = [profile?.neighborhood, profile?.city, profile?.state].filter(Boolean).join(', ');

  // Build tabs
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile?.phone_primary && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <ClickablePhone 
                    phone={profile.phone_primary} 
                    entityType="ambassador"
                    entityId={id!}
                    entityName={displayName}
                  />
                </div>
              )}
              {profile?.profiles?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.profiles.email}</span>
                </div>
              )}
              {territory && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{territory}</span>
                </div>
              )}
              {profile?.tracking_code && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Code: {profile.tracking_code}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Earnings</span>
                <span className="font-bold">${Number(profile?.total_earnings || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tier</span>
                <Badge variant="outline" className="capitalize">{profile?.tier || 'Standard'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={profile?.is_active ? 'default' : 'secondary'}>
                  {profile?.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'stores',
      label: 'My Stores',
      count: storesQuery.data?.count || 0,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Stores</CardTitle>
            <CardDescription>Stores managed by this ambassador</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {storesQuery.data?.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No stores assigned</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {storesQuery.data?.data.map((assignment: any) => (
                    <Link 
                      key={assignment.id}
                      to={`/profile/store/${assignment.store?.id}`}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Store className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{assignment.store?.store_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.store?.city}, {assignment.store?.neighborhood}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{assignment.assignment_type || 'assigned'}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'wholesalers',
      label: 'My Wholesalers',
      count: wholesalersQuery.data?.count || 0,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Wholesalers</CardTitle>
            <CardDescription>Bulk customers managed by this ambassador</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {wholesalersQuery.data?.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No wholesalers assigned</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wholesalersQuery.data?.data.map((assignment: any) => (
                    <Link 
                      key={assignment.id}
                      to={`/profile/wholesaler/${assignment.wholesaler?.id}`}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{assignment.wholesaler?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.wholesaler?.city}, {assignment.wholesaler?.state}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'influencers',
      label: 'My Influencers',
      count: influencersQuery.data?.count || 0,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Influencers / Street Team</CardTitle>
            <CardDescription>Marketing partners managed by this ambassador</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {influencersQuery.data?.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No influencers assigned</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {influencersQuery.data?.data.map((assignment: any) => (
                    <Link 
                      key={assignment.id}
                      to={`/profile/influencer/${assignment.influencer?.id}`}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Megaphone className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{assignment.influencer?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.influencer?.platform} • {assignment.influencer?.city}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'ambassadors',
      label: 'My Ambassadors',
      count: recruitsQuery.data?.count || 0,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Recruited Ambassadors</CardTitle>
            <CardDescription>Ambassadors recruited by this ambassador</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {recruitsQuery.data?.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No recruited ambassadors</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recruitsQuery.data?.data.map((recruit: any) => (
                    <Link 
                      key={recruit.id}
                      to={`/profile/ambassador/${recruit.id}`}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{recruit.name}</p>
                          <p className="text-sm text-muted-foreground">{recruit.city}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {recruit.tier && <Badge variant="outline" className="capitalize">{recruit.tier}</Badge>}
                        <Badge variant={recruit.is_active ? 'default' : 'secondary'}>
                          {recruit.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </Link>
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
            <CardDescription>Commissions and KPIs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">${Number(profile?.total_earnings || 0).toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{storesQuery.data?.count || 0}</p>
                <p className="text-sm text-muted-foreground">Stores</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{wholesalersQuery.data?.count || 0}</p>
                <p className="text-sm text-muted-foreground">Wholesalers</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{recruitsQuery.data?.count || 0}</p>
                <p className="text-sm text-muted-foreground">Recruits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      count: notesHook.notes.length,
      content: (
        <ProfileNotesTab
          notes={notesHook.notes as ProfileNote[]}
          isLoading={notesHook.isLoading}
          onAddNote={async (text) => { await notesHook.addNote({ noteText: text }); }}
          onUpdateNote={async (noteId, text) => { await notesHook.updateNote({ noteId, noteText: text }); }}
          onTogglePin={async (noteId, isPinned) => { await notesHook.togglePin({ noteId, isPinned }); }}
          onDeleteNote={async (noteId) => { await notesHook.deleteNote({ noteId }); }}
          isAdding={notesHook.isAdding}
          entityName={displayName}
        />
      ),
    },
  ];

  return (
    <Layout>
      <ProfileLayout
        isLoading={isLoading}
        backPath="/ambassadors"
        backLabel="Back to Ambassadors"
        header={{
          icon: <User className="h-6 w-6 text-primary" />,
          title: displayName,
          subtitle: `Ambassador • ${territory || 'No territory assigned'}`,
          avatarUrl: profile?.profiles?.avatar_url,
          status: {
            label: profile?.is_active ? 'Active' : 'Inactive',
            variant: profile?.is_active ? 'default' : 'secondary',
          },
          badges: profile?.tier ? [{ label: profile.tier, variant: 'outline' }] : [],
          metadata: [
            ...(territory ? [{ icon: <MapPin className="h-4 w-4" />, label: territory }] : []),
            ...(profile?.created_at ? [{ icon: <Calendar className="h-4 w-4" />, label: `Since ${format(new Date(profile.created_at), 'MMM yyyy')}` }] : []),
          ],
        }}
        stats={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ProfileStatCard
              icon={<Store className="h-5 w-5 text-primary" />}
              iconClassName="bg-primary/10"
              value={storesQuery.data?.count || 0}
              label="Stores"
              onClick={() => navigate(`/profile/ambassador/${id}?tab=stores`)}
            />
            <ProfileStatCard
              icon={<Users className="h-5 w-5 text-blue-500" />}
              iconClassName="bg-blue-500/10"
              value={wholesalersQuery.data?.count || 0}
              label="Wholesalers"
            />
            <ProfileStatCard
              icon={<Megaphone className="h-5 w-5 text-purple-500" />}
              iconClassName="bg-purple-500/10"
              value={influencersQuery.data?.count || 0}
              label="Influencers"
            />
            <ProfileStatCard
              icon={<DollarSign className="h-5 w-5 text-green-500" />}
              iconClassName="bg-green-500/10"
              value={`$${Number(profile?.total_earnings || 0).toFixed(0)}`}
              label="Earnings"
            />
          </div>
        }
        tabs={tabs}
        onAddNote={() => {}}
      />
    </Layout>
  );
}
