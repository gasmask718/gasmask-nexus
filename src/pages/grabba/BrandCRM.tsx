import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Phone, Mail, MessageSquare, Plus, TrendingUp, Store, DollarSign, 
  Package, ChevronRight, Building2, Loader2, RefreshCw, Brain, Users, 
  FileText, Bell, BarChart3, Lightbulb, AlertTriangle, Heart, Target
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { GRABBA_BRAND_CONFIG, GrabbaBrand } from '@/config/grabbaBrands';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { useBrandCRMAutoCreate } from '@/hooks/useBrandCRMAutoCreate';

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND CRM — Individual brand view with guaranteed non-blank rendering
// ═══════════════════════════════════════════════════════════════════════════════

export default function BrandCRM() {
  const { brand } = useParams<{ brand: string }>();
  const navigate = useNavigate();
  const { selectedBrand, setSelectedBrand } = useGrabbaBrand();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Map URL param to brand config
  const brandKey = brand as GrabbaBrand;
  const brandConfig = GRABBA_BRAND_CONFIG[brandKey];

  // Use self-healing CRM hook - guaranteed to return safe data
  const {
    accounts,
    contacts,
    orders,
    insights,
    stats,
    isLoading,
    isBuilding,
    hasData,
    autoLink,
    refetch
  } = useBrandCRMAutoCreate(brandKey);

  // Auto-trigger linking on first load if no data
  const [autoLinkAttempted, setAutoLinkAttempted] = useState(false);
  
  useEffect(() => {
    if (!isLoading && !hasData && !autoLinkAttempted && brandConfig) {
      setAutoLinkAttempted(true);
      console.log(`[BrandCRM] No data found, attempting auto-link for ${brandConfig.label}...`);
      autoLink().catch(console.error);
    }
  }, [isLoading, hasData, autoLinkAttempted, brandConfig, autoLink]);

  if (!brandConfig) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Brand not found</p>
        <Button onClick={() => navigate('/grabba/crm')}>Back to CRM</Button>
      </div>
    );
  }

  const filteredAccounts = accounts.filter(acc => {
    if (!searchQuery) return true;
    const text = searchQuery.toLowerCase();
    return acc.store_master?.store_name?.toLowerCase().includes(text) ||
           acc.store_master?.city?.toLowerCase().includes(text);
  });

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
            {isBuilding && (
              <Badge variant="outline" className="animate-pulse">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Building...
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-2">
            Brand-specific customer relationship management
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="icon" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
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

      {/* ═══════════════════════════════════════════════════════════════════════════
          PERSONAL INSIGHTS — ALWAYS VISIBLE (First Section)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <Card className="border-2" style={{ borderColor: `${brandConfig.primary}50` }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" style={{ color: brandConfig.primary }} />
            Personal Insights
            {isLoading && (
              <span className="text-sm font-normal text-muted-foreground ml-2 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating insight...
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Summary */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <span className="font-medium text-sm">Summary</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <p className="text-sm text-muted-foreground">{insights.summary}</p>
              )}
            </div>

            {/* Key Traits */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="font-medium text-sm">Key Customer Traits</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-3/4" />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {insights.keyTraits.map((trait, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{trait}</Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Buying Behavior */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-sm">Buying Behavior</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <p className="text-sm text-muted-foreground">{insights.buyingBehavior}</p>
              )}
            </div>

            {/* Opportunities */}
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-green-500" />
                <span className="font-medium text-sm text-green-700">Opportunities</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {insights.opportunities.map((opp, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-green-500">•</span> {opp}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Risks */}
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="font-medium text-sm text-red-700">Risks</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {insights.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-red-500">•</span> {risk}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Relationship Summary */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-sm">Relationship</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <p className="text-sm text-muted-foreground">{insights.relationshipSummary}</p>
              )}
            </div>
          </div>

          {/* Personal Notes */}
          <div className="mt-4 p-4 rounded-lg border border-dashed">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Personal Notes</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <p className="text-sm text-muted-foreground italic">{insights.personalNotes}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats - Always visible */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-t-4" style={{ borderTopColor: brandConfig.primary }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-muted-foreground" />
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold">{stats.totalStores}</div>
                )}
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
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold">{stats.totalContacts}</div>
                )}
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
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
                )}
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
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold">{stats.totalOrders}</div>
                )}
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

      {/* Tabs - All sections always render */}
      <Tabs defaultValue="stores">
        <TabsList>
          <TabsTrigger value="stores">Stores ({filteredAccounts.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Stores Tab */}
        <TabsContent value="stores" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAccounts.length > 0 ? (
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
                        <h3 className="text-lg font-semibold">{account.store_master?.store_name || 'Unknown Store'}</h3>
                        <Badge className={brandConfig.pill}>{account.loyalty_level}</Badge>
                        {account.active_status && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {account.store_master?.address || 'No address'}, {account.store_master?.city || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-2 mt-3 text-xs">
                        <span className="text-muted-foreground">
                          ${Number(account.total_spent || 0).toFixed(0)} spent
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{account.credit_terms}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Store className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No stores linked to {brandConfig.label} yet</p>
                <Button onClick={() => autoLink()} variant="outline" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Build CRM Links
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : contacts.length > 0 ? (
            contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{contact.contact_name}</h3>
                      <div className="text-sm text-muted-foreground mt-1">
                        {contact.contact_phone || 'No phone'} • {contact.contact_email || 'No email'}
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
                      <Button size="sm" variant="outline"><Phone className="w-4 h-4" /></Button>
                      <Button size="sm" variant="outline"><MessageSquare className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No contacts yet for {brandConfig.label}</p>
                <p className="text-sm text-muted-foreground mt-2">Contacts will appear as you add them</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-5 w-40 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : orders.length > 0 ? (
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
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No orders found for {brandConfig.label}</p>
                <p className="text-sm text-muted-foreground mt-2">Orders will appear as they are created</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab - Always visible */}
        <TabsContent value="analytics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" style={{ color: brandConfig.primary }} />
                Analytics Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Avg Order Value</p>
                  <p className="text-2xl font-bold">
                    ${orders.length > 0 
                      ? (orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0) / orders.length).toFixed(2)
                      : '0.00'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Active Rate</p>
                  <p className="text-2xl font-bold">
                    {accounts.length > 0 
                      ? `${Math.round((accounts.filter((a: any) => a.active_status).length / accounts.length) * 100)}%`
                      : '0%'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">VIP Stores</p>
                  <p className="text-2xl font-bold">
                    {accounts.filter((a: any) => a.loyalty_level === 'vip').length}
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-lg border-l-4" style={{ backgroundColor: `${brandConfig.primary}10`, borderLeftColor: brandConfig.primary }}>
                <p className="font-medium mb-1">Performance Insight</p>
                <p className="text-sm text-muted-foreground">
                  {accounts.length > 0 
                    ? `${brandConfig.label} has ${accounts.length} connected stores with $${stats.totalRevenue.toLocaleString()} total revenue.`
                    : `Start building your ${brandConfig.label} network by linking stores.`}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab - Always visible */}
        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" style={{ color: brandConfig.primary }} />
                Alerts & Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-yellow-500" />
                    <span className="font-medium text-sm">Reorder Reminder</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {accounts.length > 0 
                      ? `${Math.min(accounts.length, 5)} stores may need reorder reminders`
                      : 'No stores to monitor yet'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-sm">Growth Opportunity</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Consider expanding {brandConfig.label} presence in new regions
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">No urgent alerts</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    All {brandConfig.label} operations running smoothly
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
