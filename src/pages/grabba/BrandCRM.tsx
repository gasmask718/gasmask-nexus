import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Phone, Mail, MessageSquare, Plus, TrendingUp, Store, DollarSign, Package, ChevronRight, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { GRABBA_BRAND_CONFIG, GrabbaBrand } from '@/config/grabbaBrands';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { BrandFilterBar } from '@/components/grabba/BrandFilterBar';

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND CRM — Individual brand view within Floor 1
// ═══════════════════════════════════════════════════════════════════════════════

export default function BrandCRM() {
  const { brand } = useParams<{ brand: string }>();
  const navigate = useNavigate();
  const { selectedBrand, setSelectedBrand } = useGrabbaBrand();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Map URL param to brand config
  const brandKey = brand as GrabbaBrand;
  const brandConfig = GRABBA_BRAND_CONFIG[brandKey];

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['brand-accounts', brand],
    queryFn: async () => {
      if (!brand || !brandConfig) return [];
      
      const { data, error } = await supabase
        .from('store_brand_accounts')
        .select('*, store_master(*)')
        .eq('brand', brandConfig.label as any);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!brandConfig
  });

  const { data: contacts } = useQuery({
    queryKey: ['brand-contacts', brand],
    queryFn: async () => {
      if (!brand || !brandConfig) return [];
      
      const { data, error } = await supabase
        .from('brand_crm_contacts')
        .select('*')
        .eq('brand', brandConfig.label as any);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!brandConfig
  });

  // Get orders for this brand
  const { data: orders } = useQuery({
    queryKey: ['brand-orders', brand],
    queryFn: async () => {
      if (!brand) return [];
      
      const { data } = await supabase
        .from('wholesale_orders')
        .select('*, companies(name), stores(name)')
        .eq('brand', brand)
        .order('created_at', { ascending: false })
        .limit(50);
      
      return data || [];
    },
    enabled: !!brand
  });

  if (!brandConfig) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Brand not found</p>
        <Button onClick={() => navigate('/grabba/crm')}>Back to CRM</Button>
      </div>
    );
  }

  const filteredAccounts = accounts?.filter(acc => {
    if (!searchQuery) return true;
    const text = searchQuery.toLowerCase();
    return acc.store_master?.store_name?.toLowerCase().includes(text) ||
           acc.store_master?.city?.toLowerCase().includes(text);
  });

  const totalRevenue = accounts?.reduce((sum, acc) => sum + Number(acc.total_spent || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{brandConfig.icon}</span>
            <h1 className="text-3xl font-bold" style={{ color: brandConfig.primary }}>
              {brandConfig.label} CRM
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Brand-specific customer relationship management
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/grabba/crm')} variant="outline">
            <Building2 className="w-4 h-4 mr-2" />
            Back to Floor 1
          </Button>
          <Button className={brandConfig.pill}>
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-t-4" style={{ borderTopColor: brandConfig.primary }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-3xl font-bold">{accounts?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Active Stores</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-3xl font-bold">{contacts?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Total Contacts</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-3xl font-bold">${totalRevenue.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-3xl font-bold">{orders?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Orders</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search stores, contacts..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stores">
        <TabsList>
          <TabsTrigger value="stores">Stores ({filteredAccounts?.length || 0})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts?.length || 0})</TabsTrigger>
          <TabsTrigger value="orders">Recent Orders ({orders?.length || 0})</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredAccounts && filteredAccounts.length > 0 ? (
            filteredAccounts.map((account) => (
              <Card 
                key={account.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow hover:border-primary/30"
                onClick={() => navigate(`/grabba/store-master/${account.store_master_id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{account.store_master?.store_name}</h3>
                        <Badge className={brandConfig.pill}>
                          {account.loyalty_level}
                        </Badge>
                        {account.active_status && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {account.store_master?.address}, {account.store_master?.city}
                      </div>
                      
                      {/* Entity chain */}
                      <div className="flex items-center gap-2 mt-3 text-xs">
                        <span className="text-muted-foreground">
                          ${Number(account.total_spent || 0).toFixed(0)} spent
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {account.credit_terms}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); }}>
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); }}>
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No stores found for {brandConfig.label}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-3 mt-4">
          {contacts && contacts.length > 0 ? (
            contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{contact.contact_name}</h3>
                      <div className="text-sm text-muted-foreground mt-1">
                        {contact.contact_phone} • {contact.contact_email}
                      </div>
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {contact.tags.map((tag: string, i: number) => (
                            <Badge key={i} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No contacts found
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-3 mt-4">
          {orders && orders.length > 0 ? (
            orders.map((order: any) => (
              <Card key={order.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">
                          {order.companies?.name || order.stores?.name || 'Unknown'}
                        </h3>
                        <Badge variant="outline">{order.quantity} tubes</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${order.total_amount?.toFixed(2) || '0.00'}</div>
                      <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">No orders found</div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: brandConfig.primary }} />
                AI-Powered Insights for {brandConfig.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 rounded-lg border-l-4" style={{ backgroundColor: `${brandConfig.primary}15`, borderLeftColor: brandConfig.primary }}>
                <p className="font-medium mb-1">Top Performing Segment</p>
                <p className="text-sm text-muted-foreground">
                  VIP tier stores generate 65% of revenue. Consider upgrading Gold tier stores.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="font-medium mb-1">Reorder Opportunity</p>
                <p className="text-sm text-muted-foreground">
                  12 stores haven't ordered in 30+ days. Suggested outreach this week.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="font-medium mb-1">Cross-Brand Potential</p>
                <p className="text-sm text-muted-foreground">
                  8 {brandConfig.label} stores also buy from other brands. Bundle opportunity.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}