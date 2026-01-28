/**
 * StoreProfilePage - Retail Store Profile
 * Route: /profile/store/:id
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Store, MapPin, Calendar, Phone, Mail, Package, DollarSign,
  User, TrendingUp, AlertTriangle, CheckCircle, Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProfileLayout, ProfileStatCard, ProfileNotesTab, ProfileNote } from '@/components/profile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEntityNotes } from '@/hooks/useEntityNotes';
import { ClickablePhone } from '@/components/communication/ClickablePhone';

export default function StoreProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch store profile
  const profileQuery = useQuery({
    queryKey: ['store-profile-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('store_master')
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
    queryKey: ['store-orders-count', id],
    queryFn: async () => {
      if (!id) return { count: 0, data: [], total: 0 };
      const { data, error, count } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('store_id', id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      const total = (data || []).reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
      return { count: count || 0, data: data || [], total };
    },
    enabled: !!id,
  });

  // Fetch assigned ambassador
  const assignmentQuery = useQuery({
    queryKey: ['store-ambassador', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('store_assignments')
        .select(`
          *,
          ambassador:ambassador_id (id, name, city, phone_primary)
        `)
        .eq('store_id', id)
        .eq('active', true)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!id,
  });

  // Notes hook
  const notesHook = useEntityNotes('store', id);

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading;

  if (!profile && !isLoading) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Store Not Found</h2>
        <Button onClick={() => navigate('/stores')}>Back to Stores</Button>
      </div>
    );
  }

  const displayName = profile?.store_name || profile?.owner_name || 'Store';
  const address = [profile?.address, profile?.city, profile?.state].filter(Boolean).join(', ');

  // Calculate order stats
  const paidOrders = ordersQuery.data?.data.filter((o: any) => o.payment_status === 'paid') || [];
  const unpaidOrders = ordersQuery.data?.data.filter((o: any) => o.payment_status !== 'paid') || [];

  // Build tabs
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Store Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile?.owner_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{profile.owner_name}</span>
                </div>
              )}
              {address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{address}</span>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <ClickablePhone 
                    phone={profile.phone} 
                    entityType="store"
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
              {profile?.store_type && (
                <Badge variant="outline" className="capitalize">{profile.store_type}</Badge>
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
            <CardTitle>Order History</CardTitle>
            <CardDescription>All orders from this store</CardDescription>
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
                          <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                            {order.payment_status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">${Number(order.total || 0).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{order.status}</p>
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
      id: 'kpis',
      label: 'KPIs',
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Store KPIs and performance data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{ordersQuery.data?.count || 0}</p>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">${Number(ordersQuery.data?.total || 0).toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <p className="text-2xl font-bold text-green-500">{paidOrders.length}</p>
                <p className="text-sm text-muted-foreground">Paid Orders</p>
              </div>
              <div className="text-center p-4 bg-amber-500/10 rounded-lg">
                <p className="text-2xl font-bold text-amber-500">{unpaidOrders.length}</p>
                <p className="text-sm text-muted-foreground">Unpaid</p>
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
    <ProfileLayout
        isLoading={isLoading}
        backPath="/stores"
        backLabel="Back to Stores"
        header={{
          icon: <Store className="h-6 w-6 text-primary" />,
          title: displayName,
          subtitle: address || 'Retail Location',
          status: {
            label: 'active',
            variant: 'default',
          },
          badges: profile?.store_type ? [{ label: profile.store_type, variant: 'outline' }] : [],
          metadata: [
            ...(address ? [{ icon: <MapPin className="h-4 w-4" />, label: address }] : []),
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
              label="Total Value"
            />
            <ProfileStatCard
              icon={<CheckCircle className="h-5 w-5 text-green-500" />}
              iconClassName="bg-green-500/10"
              value={paidOrders.length}
              label="Paid Orders"
            />
            <ProfileStatCard
              icon={<Clock className="h-5 w-5 text-amber-500" />}
              iconClassName="bg-amber-500/10"
              value={unpaidOrders.length}
              label="Unpaid"
            />
          </div>
        }
        tabs={tabs}
        onAddNote={() => {}}
      />
  );
}
