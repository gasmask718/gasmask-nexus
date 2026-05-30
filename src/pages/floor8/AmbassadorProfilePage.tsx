/**
 * Floor 8 — Ambassador Profile (Admin View)
 * Individual accountability + growth intelligence
 * Tabs: Overview, Stores, Purchases, Wholesale Profit, Commissions, Payouts, Communication
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft, User, MapPin, Phone, Mail, Store, DollarSign,
  TrendingUp, TrendingDown, Minus, MessageSquare,
  AlertTriangle, Wallet, Star, ShoppingBag, TrendingUp as TrendingUpIcon2,
  StickyNote, Route as RouteIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClickablePhone } from '@/components/communication/ClickablePhone';
import { AmbassadorStoresTab } from '@/components/floor8/AmbassadorStoresTab';
import { useAmbassadorStoreData } from '@/hooks/useAmbassadorStoreData';
import { cn } from '@/lib/utils';
import { AmbassadorPurchasesSection } from '@/components/ambassador/purchases/AmbassadorPurchasesSection';
import { AmbassadorProfitTab } from '@/components/floor8/AmbassadorProfitTab';
import { ConversationInbox } from '@/components/communication/ConversationInbox';
import { EntityNotesSection } from '@/components/grabba/EntityNotesSection';
import { TerritoryCoveragePanel } from '@/components/ambassador/TerritoryCoveragePanel';
import { ProfileCompletenessScore, computeAmbassadorCompleteness } from '@/components/profile/ProfileCompletenessScore';
import { useAmbassadorTerritory } from '@/hooks/useAmbassadorTerritory';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';

export default function AmbassadorProfilePage() {
  const { ambassadorId } = useParams<{ ambassadorId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showRouteAssign, setShowRouteAssign] = useState(false);

  // Fetch ambassador profile
  const { data: ambassador, isLoading } = useQuery({
    queryKey: ['floor8-ambassador-profile', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return null;
      const { data, error } = await supabase
        .from('ambassadors')
        .select(`
          *,
          profiles:user_id (name, email, avatar_url)
        `)
        .eq('id', ambassadorId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!ambassadorId,
  });

  // Fetch assigned stores (legacy query, now supplemented by useAmbassadorStoreData)
  const { data: stores = [] } = useQuery({
    queryKey: ['floor8-ambassador-stores', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];
      const { data, error } = await supabase
        .from('ambassador_assignments')
        .select(`
          *,
          store:store_id (id, store_name, city, address, health_status)
        `)
        .eq('ambassador_id', ambassadorId)
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Fetch commission events
  const { data: commissions = [] } = useQuery({
    queryKey: ['floor8-ambassador-commissions', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];
      const { data, error } = await supabase
        .from('commission_events')
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Payouts are derived from paid commissions
  const payouts = commissions.filter(c => c.status === 'paid');

  // Fetch communications
  const { data: communications = [] } = useQuery({
    queryKey: ['floor8-ambassador-communications', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('entity_type', 'ambassador')
        .eq('entity_id', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Fetch separated store data (sourced vs assigned vs pipeline)
  const { sourcedStores, assignedStores, pipeline } = useAmbassadorStoreData(ambassadorId);
  const { territories } = useAmbassadorTerritory(ambassadorId);

  // Calculate metrics
  const pendingCommissions = commissions.filter(c => c.status === 'pending');
  const paidCommissions = commissions.filter(c => c.status === 'paid');
  const totalPending = pendingCommissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
  const totalPaid = paidCommissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
  const totalRevenue = commissions.reduce((sum, c) => sum + Number(c.gross_amount || 0), 0);
  const activeStores = stores.filter(s => s.active).length;

  // Calculate trend (based on last 30 days vs previous 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  
  const recentCommissions = commissions.filter(c => new Date(c.created_at) >= thirtyDaysAgo);
  const previousCommissions = commissions.filter(c => 
    new Date(c.created_at) >= sixtyDaysAgo && new Date(c.created_at) < thirtyDaysAgo
  );
  
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentCommissions.length > previousCommissions.length * 1.2) trend = 'improving';
  else if (recentCommissions.length < previousCommissions.length * 0.8) trend = 'declining';

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center p-12">
          <div className="animate-pulse text-muted-foreground">Loading ambassador...</div>
        </div>
      </Layout>
    );
  }

  if (!ambassador) {
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

  const displayName = ambassador.name || ambassador.profiles?.name || 'Ambassador';
  const territory = [ambassador.neighborhood, ambassador.city, ambassador.state].filter(Boolean).join(', ');

  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const trendColor = trend === 'improving' ? 'text-green-500' : trend === 'declining' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ambassadors')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {territory && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> {territory}
                    </span>
                  )}
                  <Badge variant={ambassador.is_active ? 'default' : 'secondary'}>
                    {ambassador.is_active ? 'Active' : 'Paused'}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{ambassador.tier || 'starter'}</Badge>
                  <TrendIcon className={cn('h-4 w-4', trendColor)} />
                </div>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowRouteAssign(true)}>
            <RouteIcon className="mr-1 h-4 w-4" /> Assign Route
          </Button>
        </div>

        {/* KPI Cards - Distinct sourced vs managed counts */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Stores Sourced</div>
              <div className="text-2xl font-bold">{sourcedStores.length}</div>
              <div className="text-xs text-primary">Attribution credit</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Stores Managed</div>
              <div className="text-2xl font-bold">{assignedStores.length}</div>
              <div className="text-xs text-cyan-400">Operational</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Revenue Generated</div>
              <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Pending Payout</div>
              <div className="text-2xl font-bold text-amber-500">${totalPending.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Total Paid</div>
              <div className="text-2xl font-bold text-green-500">${totalPaid.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Trend</div>
              <div className="flex items-center gap-2">
                <TrendIcon className={cn('h-5 w-5', trendColor)} />
                <span className={cn('font-semibold capitalize', trendColor)}>{trend}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="stores">Stores ({sourcedStores.length + assignedStores.length})</TabsTrigger>
            <TabsTrigger value="purchases">
              <ShoppingBag className="h-4 w-4 mr-1" />
              Purchases
            </TabsTrigger>
            <TabsTrigger value="wholesale-profit">
              <TrendingUpIcon2 className="h-4 w-4 mr-1" />
              Wholesale Profit
            </TabsTrigger>
            <TabsTrigger value="commissions">Commissions ({commissions.length})</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="territory">Territory ({territories.length})</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ambassador.phone_primary && (
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50">
                      <Phone className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <ClickablePhone 
                          phone={ambassador.phone_primary}
                          entityType="ambassador"
                          entityId={ambassadorId!}
                          entityName={displayName}
                        />
                      </div>
                    </div>
                  )}
                  {ambassador.profiles?.email && (
                    <div className="flex items-center gap-3 p-3 rounded-lg">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p>{ambassador.profiles.email}</p>
                      </div>
                    </div>
                  )}
                  {ambassador.tracking_code && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Star className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Tracking Code</p>
                        <p className="font-mono">{ambassador.tracking_code}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Earnings</span>
                    <span className="font-bold">${Number(ambassador.total_earnings || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Attribution Confidence</span>
                    <Badge variant="outline">High</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Activity</span>
                    <span>{commissions[0] ? format(new Date(commissions[0].created_at), 'MMM d, yyyy') : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Member Since</span>
                    <span>{format(new Date(ambassador.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="stores" className="mt-4">
            <AmbassadorStoresTab
              ambassadorId={ambassadorId!}
              ambassadorName={displayName}
              sourcedStores={sourcedStores}
              assignedStores={assignedStores}
              pipeline={pipeline}
              onMessage={(storeId) => {
                // TODO: Open message modal
                console.log('Message store:', storeId);
              }}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ['ambassador-assigned-stores', ambassadorId] });
                queryClient.invalidateQueries({ queryKey: ['ambassador-sourced-stores', ambassadorId] });
                queryClient.invalidateQueries({ queryKey: ['floor8-ambassador-stores', ambassadorId] });
              }}
            />
          </TabsContent>

          <TabsContent value="purchases" className="mt-4">
            <AmbassadorPurchasesSection
              ambassadorUserId={ambassador.user_id}
              ambassadorId={ambassadorId}
              ambassadorName={displayName}
            />
          </TabsContent>

          <TabsContent value="wholesale-profit" className="mt-4">
            <AmbassadorProfitTab ambassadorId={ambassadorId!} />
          </TabsContent>

          <TabsContent value="commissions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Commission Events</CardTitle>
                <CardDescription>All commission transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {commissions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No commissions yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Gross Amount</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions.map((comm: any) => (
                        <TableRow key={comm.id}>
                          <TableCell>
                            {format(new Date(comm.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{comm.source_type || 'order'}</Badge>
                          </TableCell>
                          <TableCell>${Number(comm.gross_amount || 0).toFixed(2)}</TableCell>
                          <TableCell className="font-bold">
                            ${Number(comm.commission_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={comm.status === 'paid' ? 'default' : comm.status === 'pending' ? 'secondary' : 'destructive'}
                            >
                              {comm.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>All payouts to this ambassador</CardDescription>
              </CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No payouts yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((payout: any) => (
                        <TableRow key={payout.id}>
                          <TableCell>
                            {format(new Date(payout.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>{payout.period || 'N/A'}</TableCell>
                          <TableCell className="font-bold">${Number(payout.amount || 0).toFixed(2)}</TableCell>
                          <TableCell>{payout.method || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={payout.status === 'paid' ? 'default' : 'secondary'}>
                              {payout.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="territory" className="mt-4">
            <div className="space-y-4">
              {(() => {
                const completeness = computeAmbassadorCompleteness(ambassador, territories.length);
                return <ProfileCompletenessScore score={completeness.score} missingFields={completeness.missingFields} />;
              })()}
              <TerritoryCoveragePanel ambassadorId={ambassadorId!} isEditable={true} />
            </div>
          </TabsContent>

          <TabsContent value="communication" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Panel — Contact Info */}
              <Card className="lg:col-span-1 h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4" />
                    Contact Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-semibold text-lg">{displayName}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge className={ambassador.is_active ? 'bg-green-500/15 text-green-600 border-green-500/30' : 'bg-muted text-muted-foreground'}>
                        {ambassador.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="capitalize">{ambassador.tier || 'Starter'}</Badge>
                    </div>
                  </div>

                  {ambassador.phone_primary && (
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <Phone className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <ClickablePhone
                          phone={ambassador.phone_primary}
                          entityType="ambassador"
                          entityId={ambassadorId!}
                          entityName={displayName}
                        />
                      </div>
                    </div>
                  )}

                  {ambassador.profiles?.email && (
                    <div className="flex items-center gap-3 p-2 rounded-lg">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm truncate">{ambassador.profiles.email}</p>
                      </div>
                    </div>
                  )}

                  {ambassador.city && (
                    <div className="flex items-center gap-3 p-2 rounded-lg">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Location</p>
                        <p className="text-sm">{ambassador.city}{ambassador.neighborhood ? `, ${ambassador.neighborhood}` : ''}</p>
                      </div>
                    </div>
                  )}

                  {ambassador.tracking_code && (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <Star className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Tracking Code</p>
                        <p className="text-sm font-mono">{ambassador.tracking_code}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Quick Stats</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Stores:</span> <span className="font-medium">{sourcedStores.length + assignedStores.length}</span></div>
                      <div><span className="text-muted-foreground">Revenue:</span> <span className="font-medium">${totalRevenue.toLocaleString()}</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Center Panel — Communication Console */}
              <div className="lg:col-span-2 space-y-6">
                <ConversationInbox
                  entityType="ambassador"
                  entityId={ambassadorId!}
                  entityName={displayName}
                  isEditable={true}
                />

                {/* Notes Section */}
                <EntityNotesSection
                  entityType="ambassador"
                  entityId={ambassadorId}
                  entityName={displayName}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
