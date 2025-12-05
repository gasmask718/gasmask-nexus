import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, Mail, MapPin, DollarSign, Package, TrendingUp, Building2, 
  ChevronRight, MessageSquare, ArrowLeft, Store, FileText, Truck
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GRABBA_BRAND_CONFIG, GrabbaBrand } from '@/config/grabbaBrands';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { BrandBadgesRow } from '@/components/grabba/BrandFilterBar';
import { AIExtractedProfileCard } from '@/components/grabba/AIExtractedProfileCard';
import { StoreProfileSections } from './components/StoreProfileSections';
import { getExtractedProfile } from '@/services/profileExtractionService';
import { StoreContactsSection } from '@/components/store/StoreContactsSection';
import { RecentStoreInteractions } from '@/components/crm/RecentStoreInteractions';
import { LogInteractionModal } from '@/components/crm/LogInteractionModal';

// ═══════════════════════════════════════════════════════════════════════════════
// STORE MASTER PROFILE — Unified store view within Floor 1 CRM
// ═══════════════════════════════════════════════════════════════════════════════

export default function StoreMasterProfile() {
  const params = useParams();
  const id = params.id || params.storeId; // Support both route params
  const navigate = useNavigate();
  const { selectedBrand } = useGrabbaBrand();
  const [showLogModal, setShowLogModal] = useState(false);

  // Fetch store contacts for the modal
  const { data: storeContacts } = useQuery({
    queryKey: ['store-contacts-for-modal', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_contacts')
        .select('id, name')
        .eq('store_id', id);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: storeMaster, isLoading } = useQuery({
    queryKey: ['store-master', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('*, store_brand_accounts(*)')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: brandAccounts } = useQuery({
    queryKey: ['brand-accounts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_brand_accounts')
        .select('*')
        .eq('store_master_id', id);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch orders for this store
  const { data: orders } = useQuery({
    queryKey: ['store-orders', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('wholesale_orders')
        .select('*')
        .eq('store_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    }
  });

  // Fetch payments for this store
  const { data: payments } = useQuery({
    queryKey: ['store-payments', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_payments')
        .select('*')
        .eq('store_id', id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  // Fetch extracted AI profile
  const { data: aiProfile } = useQuery({
    queryKey: ['extracted-profile', id],
    queryFn: () => getExtractedProfile(id || ''),
    enabled: !!id
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  if (!storeMaster) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground mb-4">Store not found</p>
        <Button onClick={() => navigate('/grabba/crm')}>Back to CRM</Button>
      </div>
    );
  }

  const totalSpent = brandAccounts?.reduce((sum, acc) => sum + Number(acc.total_spent || 0), 0) || 0;
  const activeBrands = brandAccounts?.filter(a => a.active_status).map(a => a.brand as string) || [];
  const unpaidBalance = payments?.filter((p: any) => p.payment_status !== 'paid')
    .reduce((sum: number, p: any) => sum + ((p.owed_amount || 0) - (p.paid_amount || 0)), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/grabba/crm')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Store className="h-6 w-6 text-green-500" />
            <h1 className="text-2xl font-bold">{storeMaster.store_name}</h1>
            {activeBrands.length > 0 && (
              <div className="flex gap-1">
                {activeBrands.map(brand => {
                  const config = GRABBA_BRAND_CONFIG[brand.toLowerCase().replace(' ', '_') as keyof typeof GRABBA_BRAND_CONFIG];
                  return config ? (
                    <Badge key={brand} className={config.pill}>{config.icon}</Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Floor 1 CRM — Store Master Profile</p>
        </div>
      </div>

      {/* Entity Navigation Chain */}
      <div className="flex items-center gap-2 text-sm p-3 bg-muted/50 rounded-lg">
        <Link to="/grabba/crm" className="text-muted-foreground hover:text-primary flex items-center gap-1">
          <Building2 className="h-4 w-4" /> CRM
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-primary font-medium flex items-center gap-1">
          <Store className="h-4 w-4" /> {storeMaster.store_name}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Link to={`/grabba/inventory?store=${id}`} className="text-muted-foreground hover:text-primary flex items-center gap-1">
          <Package className="h-4 w-4" /> Orders
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Link to={`/unpaid-accounts?store=${id}`} className="text-muted-foreground hover:text-primary flex items-center gap-1">
          <DollarSign className="h-4 w-4" /> Payments
        </Link>
      </div>

      {/* Store Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            Store Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Address</div>
              <div className="font-medium">
                {storeMaster.address}<br />
                {storeMaster.city}, {storeMaster.state} {storeMaster.zip}
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Phone className="w-4 h-4" /> Phone
              </div>
              <div className="font-medium">{storeMaster.phone || 'N/A'}</div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Mail className="w-4 h-4" /> Email
              </div>
              <div className="font-medium">{storeMaster.email || 'N/A'}</div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" /> Total Spent
              </div>
              <div className="text-2xl font-bold text-green-500">${totalSpent.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Contacts */}
      <StoreContactsSection storeId={id || ''} storeName={storeMaster.store_name} />

      {/* Recent Interactions */}
      <RecentStoreInteractions
        storeId={id || ''}
        onLogInteraction={(_resolvedId) => setShowLogModal(true)}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{orders?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Total Orders</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{brandAccounts?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Brand Accounts</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{activeBrands.length}</div>
            <div className="text-sm text-muted-foreground">Active Brands</div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${unpaidBalance > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
          <CardContent className="pt-6">
            <div className={`text-3xl font-bold ${unpaidBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
              ${unpaidBalance.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Unpaid Balance</div>
          </CardContent>
        </Card>
      </div>

      {/* Brand Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Breakdown</CardTitle>
          <CardDescription>Performance by Grabba brand</CardDescription>
        </CardHeader>
        <CardContent>
          {brandAccounts && brandAccounts.length > 0 ? (
            <Tabs defaultValue={brandAccounts[0]?.brand}>
              <TabsList className="flex-wrap h-auto">
                {brandAccounts.map((account) => {
                  const brandKey = account.brand?.toLowerCase().replace(' ', '_') as keyof typeof GRABBA_BRAND_CONFIG;
                  const config = GRABBA_BRAND_CONFIG[brandKey];
                  return (
                    <TabsTrigger key={account.id} value={account.brand} className="flex items-center gap-2">
                      {config?.icon} {account.brand}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {brandAccounts.map((account) => {
                const brandKey = account.brand?.toLowerCase().replace(' ', '_') as keyof typeof GRABBA_BRAND_CONFIG;
                const config = GRABBA_BRAND_CONFIG[brandKey];
                
                return (
                  <TabsContent key={account.id} value={account.brand} className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className={`bg-gradient-to-br ${config?.gradient || ''}`}>
                        <CardContent className="pt-6">
                          <div className="text-sm text-muted-foreground mb-1">Total Spent</div>
                          <div className="text-2xl font-bold">${Number(account.total_spent || 0).toLocaleString()}</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-sm text-muted-foreground mb-1">Loyalty Level</div>
                          <Badge className={config?.pill}>{account.loyalty_level}</Badge>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-sm text-muted-foreground mb-1">Credit Terms</div>
                          <div className="font-medium">{account.credit_terms}</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-sm text-muted-foreground mb-1">Status</div>
                          <Badge variant={account.active_status ? 'default' : 'secondary'}>
                            {account.active_status ? 'Active' : 'Inactive'}
                          </Badge>
                        </CardContent>
                      </Card>
                    </div>

                    {/* AI Insights for this brand */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" style={{ color: config?.primary }} />
                          AI Insights
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <p className="text-sm font-medium mb-1">Reorder Prediction</p>
                          <p className="text-xs text-muted-foreground">
                            This store typically orders {account.brand} products every 2 weeks
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <p className="text-sm font-medium mb-1">Cross-Sell Opportunity</p>
                          <p className="text-xs text-muted-foreground">
                            Consider offering bundle deals with other brands
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No brand accounts found for this store
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Extraction Card */}
      <AIExtractedProfileCard 
        storeId={id || ''} 
        storeName={storeMaster.store_name}
        notes={storeMaster.notes}
      />

      {/* AI Profile Sections - Three Key Areas */}
      {aiProfile && (
        <StoreProfileSections 
          profile={aiProfile}
          recentOrders={orders}
          totalSpent={totalSpent}
        />
      )}

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders && orders.length > 0 ? (
            <div className="space-y-2">
              {orders.slice(0, 5).map((order: any) => {
                const brandKey = order.brand?.toLowerCase().replace(' ', '_') as keyof typeof GRABBA_BRAND_CONFIG;
                const config = GRABBA_BRAND_CONFIG[brandKey];
                return (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={config?.pill || ''}>{config?.icon} {order.brand}</Badge>
                      <span>{order.quantity} tubes</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                      <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No orders found</div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => navigate(`/grabba/communication?store=${id}`)}>
          <MessageSquare className="w-4 h-4 mr-2" />
          Send Message
        </Button>
        <Button variant="outline" onClick={() => navigate(`/grabba/deliveries?store=${id}`)}>
          <Truck className="w-4 h-4 mr-2" />
          Schedule Delivery
        </Button>
        <Button variant="outline" onClick={() => navigate(`/grabba/inventory?store=${id}`)}>
          <Package className="w-4 h-4 mr-2" />
          View Inventory
        </Button>
      </div>

      {/* Log Interaction Modal */}
      <LogInteractionModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        storeMasterId={id}
        storeName={storeMaster.store_name}
        storeContacts={storeContacts || []}
      />
    </div>
  );
}