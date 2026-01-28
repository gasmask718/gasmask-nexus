/**
 * WholesalerProfilePage - Wholesaler (Bulk Customer) Profile
 * Route: /profile/wholesaler/:id
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Building2, MapPin, Calendar, Phone, Mail, Package, DollarSign,
  Store, User, TrendingUp, AlertTriangle, FileText
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

export default function WholesalerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch wholesaler profile
  const profileQuery = useQuery({
    queryKey: ['wholesaler-profile-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('wholesaler_profiles')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch orders
  const ordersQuery = useQuery({
    queryKey: ['wholesaler-orders-count', id],
    queryFn: async () => {
      if (!id) return { count: 0, data: [], total: 0 };
      const { data, error, count } = await supabase
        .from('wholesaler_orders')
        .select('*', { count: 'exact' })
        .eq('wholesaler_id', id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      const total = (data || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
      return { count: count || 0, data: data || [], total };
    },
    enabled: !!id,
  });

  // Fetch assigned ambassador
  const assignmentQuery = useQuery({
    queryKey: ['wholesaler-ambassador', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('wholesaler_assignments')
        .select(`
          *,
          ambassador:ambassador_id (id, name, city, phone_primary)
        `)
        .eq('wholesaler_id', id)
        .eq('active', true)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!id,
  });

  // Notes hook
  const notesHook = useEntityNotes('wholesaler', id);

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading;

  if (!profile && !isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Wholesaler Not Found</h2>
          <Button onClick={() => navigate('/wholesale')}>Back to Wholesalers</Button>
        </div>
      </Layout>
    );
  }

  const displayName = profile?.company_name || profile?.contact_name || 'Wholesaler';

  // Build tabs
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile?.company_name && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{profile.company_name}</span>
                </div>
              )}
              {profile?.contact_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.contact_name}</span>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <ClickablePhone 
                    phone={profile.phone} 
                    entityType="wholesaler"
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
              {profile?.tax_id && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Tax ID: {profile.tax_id}</span>
                </div>
              )}
              {profile?.wholesaler_type && (
                <Badge variant="outline" className="capitalize">{profile.wholesaler_type}</Badge>
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
      id: 'orders',
      label: 'Orders',
      count: ordersQuery.data?.count || 0,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
            <CardDescription>All orders from this wholesaler</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {ordersQuery.data?.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No orders yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ordersQuery.data?.data.map((order: any) => (
                    <div 
                      key={order.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Order #{order.id.slice(-6)}</span>
                          <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${Number(order.total_amount || 0).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{order.items_count || 0} items</p>
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
      id: 'pricing',
      label: 'Pricing & Terms',
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Terms</CardTitle>
            <CardDescription>Private wholesale pricing agreements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge variant={profile?.status === 'active' ? 'default' : 'secondary'}>
                  {profile?.status || 'pending'}
                </Badge>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Type</p>
                <p className="font-medium capitalize">{profile?.wholesaler_type || 'Standard'}</p>
              </div>
            </div>
            {profile?.notes && (
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{profile.notes}</p>
              </div>
            )}
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
        backPath="/wholesale"
        backLabel="Back to Wholesalers"
        header={{
          icon: <Building2 className="h-6 w-6 text-primary" />,
          title: displayName,
          subtitle: profile?.contact_name ? `Contact: ${profile.contact_name}` : 'Bulk Customer Account',
          status: {
            label: profile?.status || 'pending',
            variant: profile?.status === 'active' ? 'default' : 'secondary',
          },
          badges: profile?.wholesaler_type ? [{ label: profile.wholesaler_type, variant: 'outline' }] : [],
          metadata: [
            ...(profile?.created_at ? [{ icon: <Calendar className="h-4 w-4" />, label: `Since ${format(new Date(profile.created_at), 'MMM yyyy')}` }] : []),
          ],
        }}
        stats={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ProfileStatCard
              icon={<Package className="h-5 w-5 text-primary" />}
              iconClassName="bg-primary/10"
              value={ordersQuery.data?.count || 0}
              label="Total Orders"
            />
            <ProfileStatCard
              icon={<DollarSign className="h-5 w-5 text-green-500" />}
              iconClassName="bg-green-500/10"
              value={`$${Number(ordersQuery.data?.total || 0).toFixed(0)}`}
              label="Lifetime Spend"
            />
            <ProfileStatCard
              icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
              iconClassName="bg-blue-500/10"
              value="--"
              label="Avg Order"
            />
            <ProfileStatCard
              icon={<Store className="h-5 w-5 text-purple-500" />}
              iconClassName="bg-purple-500/10"
              value="--"
              label="Store Network"
            />
          </div>
        }
        tabs={tabs}
        onAddNote={() => {}}
      />
    </Layout>
  );
}
