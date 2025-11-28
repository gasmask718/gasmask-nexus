import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TubeMathEngine } from '@/components/company/TubeMathEngine';
import { PaymentReliabilityPanel } from '@/components/company/PaymentReliabilityPanel';
import { BrandBreakdownCards } from '@/components/company/BrandBreakdownCards';
import { NeighborhoodIntelligence } from '@/components/company/NeighborhoodIntelligence';
import { TubeIntelligencePanel } from '@/components/company/TubeIntelligencePanel';
import { PaymentScoreBadge } from '@/components/company/PaymentScoreBadge';
import { PaymentSummaryPanel } from '@/components/company/PaymentSummaryPanel';
import { 
  Building2, Phone, Mail, MapPin, ArrowLeft, Users, ShoppingCart, 
  FileText, CreditCard, Package, StickyNote, Store, Truck, User, BarChart3, 
  Star, MessageCircle, Plus, Calendar
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const typeLabels: Record<string, string> = {
  store: 'Store',
  wholesaler: 'Wholesaler',
  direct_customer: 'Direct Customer',
};

const typeBadgeColors: Record<string, string> = {
  store: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  wholesaler: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  direct_customer: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const typeIcons: Record<string, React.ReactNode> = {
  store: <Store className="h-4 w-4" />,
  wholesaler: <Truck className="h-4 w-4" />,
  direct_customer: <User className="h-4 w-4" />,
};

const brandGradients: Record<string, string> = {
  gasmask: 'from-red-600/20 to-red-900/20 border-red-500/30',
  hotmama: 'from-rose-400/20 to-rose-600/20 border-rose-500/30',
  hotscolati: 'from-red-700/20 to-red-950/20 border-red-700/30',
  grabba_r_us: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
};

export default function CompanyProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;

      // Debug: check for invalid rows
      if (!data.id || !data.name) {
        console.warn("INVALID COMPANY ROW:", data);
      }

      // Apply safe defaults for missing fields
      return {
        ...data,
        default_city: data.default_city || null,
        default_state: data.default_state || null,
        neighborhood: data.neighborhood || null,
        boro: data.boro || null,
        sells_flowers: data.sells_flowers || false,
        rpa_status: data.rpa_status || 'none',
        health_score: data.health_score ?? 50,
        payment_reliability_score: data.payment_reliability_score ?? 50,
        payment_reliability_tier: data.payment_reliability_tier || 'middle',
        type: data.type || 'store',
      };
    },
    enabled: !!id,
  });

  const { data: contacts } = useQuery({
    queryKey: ['company-contacts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_contacts')
        .select('*')
        .eq('company_id', id)
        .order('is_primary', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!id,
  });

  const { data: invoices } = useQuery({
    queryKey: ['company-invoices', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ['company-payments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_payments')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!id,
  });

  const { data: orders } = useQuery({
    queryKey: ['company-orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_orders')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!id,
  });

  // Live Tube Inventory (Manual Counts)
  const { data: liveTubeInventory } = useQuery({
    queryKey: ['live-tube-inventory', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory')
        .select('id, brand, current_tubes_left, last_updated')
        .eq('store_id', id!)
        .order('last_updated', { ascending: false });

      if (error || !data || data.length === 0) return [];

      // Group by brand, keep only latest per brand
      const brandMap = new Map<string, (typeof data)[number]>();
      for (const row of data) {
        if (!brandMap.has(row.brand)) {
          brandMap.set(row.brand, row);
        }
      }
      return Array.from(brandMap.values());
    },
    enabled: !!id,
  });

  // Tube Inventory Intelligence Header Stats
  const { data: tubeHeaderStats } = useQuery({
    queryKey: ['tube-header', id],
    queryFn: async () => {
      const { data: tubeOrders } = await supabase
        .from('wholesale_orders')
        .select('*')
        .eq('company_id', id)
        .in('brand', ['gasmask', 'hotmama', 'hotscolati', 'grabba_r_us'])
        .order('created_at', { ascending: true });

      if (!tubeOrders || tubeOrders.length === 0) {
        return {
          totalTubes: 0,
          totalBoxes: 0,
          estimatedInventory: 0,
          etaPrediction: 0,
        };
      }

      const totalTubes = tubeOrders.reduce(
        (sum, o) => sum + (o.tubes_total || (o.boxes || 0) * 100),
        0
      );
      const totalBoxes = tubeOrders.reduce((sum, o) => sum + (o.boxes || 0), 0);

      const firstOrder = new Date(tubeOrders[0].created_at);
      const lastOrder = new Date(tubeOrders[tubeOrders.length - 1].created_at);
      const weeksBetween = Math.max(
        1,
        Math.floor(
          (lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24 * 7)
        )
      );
      const avgTubesPerWeek = Math.round(totalTubes / weeksBetween);

      const lastOrderTubes =
        tubeOrders[tubeOrders.length - 1].tubes_total ||
        (tubeOrders[tubeOrders.length - 1].boxes || 0) * 100;
      const daysSinceLastOrder = Math.floor(
        (Date.now() - lastOrder.getTime()) / (1000 * 60 * 60 * 24)
      );
      const estimatedConsumption = Math.round(
        (avgTubesPerWeek / 7) * daysSinceLastOrder
      );
      const estimatedInventory = Math.max(0, lastOrderTubes - estimatedConsumption);

      const tubesPerDay = avgTubesPerWeek / 7;
      const etaPrediction =
        tubesPerDay > 0 ? Math.round(estimatedInventory / tubesPerDay) : 0;

      return {
        totalTubes,
        totalBoxes,
        estimatedInventory,
        etaPrediction,
      };
    },
    enabled: !!id,
  });

  // Helper: Convert tubes to fractional box format
  const formatTubesAsBoxes = (tubes: number) => {
    if (tubes === 0) return { fullBoxes: 0, remainder: 0, fractionLabel: 'Empty' };
    
    const fullBoxes = Math.floor(tubes / 100);
    const remainder = tubes % 100;
    
    let fractionLabel = '';
    
    if (fullBoxes > 0 && remainder === 0) {
      fractionLabel = `${fullBoxes} full box${fullBoxes > 1 ? 'es' : ''}`;
    } else if (fullBoxes > 0) {
      // Multiple boxes + remainder
      let remainderStr = '';
      if (remainder >= 1 && remainder <= 24) remainderStr = '¼ box';
      else if (remainder >= 25 && remainder <= 49) remainderStr = '½ box';
      else if (remainder >= 50 && remainder <= 74) remainderStr = '¾ box';
      else if (remainder >= 75 && remainder <= 99) remainderStr = 'almost full box';
      fractionLabel = `${fullBoxes} box${fullBoxes > 1 ? 'es' : ''} + ${remainderStr}`;
    } else {
      // Less than 100 tubes (no full boxes)
      if (remainder >= 1 && remainder <= 24) fractionLabel = '¼ box';
      else if (remainder >= 25 && remainder <= 49) fractionLabel = '½ box';
      else if (remainder >= 50 && remainder <= 74) fractionLabel = '¾ box';
      else if (remainder >= 75 && remainder <= 99) fractionLabel = 'Almost full box';
    }

    return { fullBoxes, remainder, fractionLabel };
  };

  // Brand display configs for Live Inventory
  const liveBrandConfig: Record<string, { label: string; gradient: string; pillClass: string }> = {
    gasmask: { 
      label: 'GasMask', 
      gradient: 'from-red-600/30 to-red-900/30 border-red-500/50',
      pillClass: 'bg-red-500/20 text-red-300 border-red-500/40'
    },
    hotmama: { 
      label: 'HotMama', 
      gradient: 'from-pink-500/30 to-rose-600/30 border-pink-500/50',
      pillClass: 'bg-pink-500/20 text-pink-300 border-pink-500/40'
    },
    hotscolati: { 
      label: 'HotScolati', 
      gradient: 'from-amber-500/30 to-yellow-600/30 border-amber-500/50',
      pillClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    },
    grabba_r_us: { 
      label: 'Grabba R Us', 
      gradient: 'from-emerald-500/30 to-green-600/30 border-emerald-500/50',
      pillClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    },
  };

  const allBrands = ['gasmask', 'hotmama', 'hotscolati', 'grabba_r_us'];

  if (companyLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Company not found</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </Layout>
    );
  }

  const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || Number(inv.total_amount) || 0), 0) || 0;
  const recentInvoices = invoices?.slice(0, 5) || [];
  const recentOrders = orders?.slice(0, 5) || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* === CUSTOMER HEADER === */}
        <div className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            {/* Left: Company Info */}
            <div className="flex items-start gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold">{company.name}</h1>
                  <Badge className={typeBadgeColors[company.type] || 'bg-muted'}>
                    {typeIcons[company.type]}
                    <span className="ml-1">{typeLabels[company.type] || company.type}</span>
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                  {(company.default_city || company.neighborhood) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {company.neighborhood || company.default_city}
                      {(company.boro || company.default_state) && ` • ${company.boro || company.default_state}`}
                    </span>
                  )}
                  {company.default_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {company.default_phone}
                    </span>
                  )}
                  {company.default_email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {company.default_email}
                    </span>
                  )}
                </div>
                {/* Tags */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {company.sells_flowers && (
                    <Badge variant="secondary" className="bg-pink-500/10 text-pink-400 border-pink-500/30">
                      🌸 Sells Flowers
                    </Badge>
                  )}
                  {company.rpa_status === 'rpa' && (
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      🚚 RPA Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Payment Reliability Score */}
            <div className="lg:w-64 shrink-0">
              <PaymentScoreBadge 
                score={company.payment_reliability_score || 50} 
                tier={company.payment_reliability_tier || 'middle'} 
              />
            </div>
          </div>
        </div>

        {/* === LIVE TUBE INVENTORY (MANUAL COUNTS) === */}
        <div className="w-full p-5 rounded-xl bg-gradient-to-br from-slate-900/60 to-slate-800/40 border border-border/40 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-400" />
                Current Tube Inventory (Live)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Manual counts updated by your team</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {allBrands.map((brand) => {
              const config = liveBrandConfig[brand];
              const inventoryRow = liveTubeInventory?.find(row => row.brand === brand);
              
              if (inventoryRow) {
                const tubes = inventoryRow.current_tubes_left || 0;
                const boxInfo = formatTubesAsBoxes(tubes);
                const lastUpdated = inventoryRow.last_updated 
                  ? format(new Date(inventoryRow.last_updated), 'MM/dd/yyyy')
                  : 'N/A';
                
                return (
                  <div 
                    key={brand}
                    className={`p-4 rounded-lg bg-gradient-to-br ${config.gradient} border backdrop-blur-sm`}
                  >
                    <Badge className={`${config.pillClass} border mb-2`}>
                      {config.label}
                    </Badge>
                    <p className="text-2xl font-bold text-foreground">
                      {tubes.toLocaleString()} tubes
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {boxInfo.fractionLabel}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Updated: {lastUpdated}
                    </p>
                  </div>
                );
              }
              
              // No inventory row for this brand yet
              return (
                <div 
                  key={brand}
                  className="p-4 rounded-lg bg-muted/20 border border-dashed border-border/50"
                >
                  <Badge className={`${config.pillClass} border mb-2`}>
                    {config.label}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    No manual inventory saved yet
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 text-xs h-7 px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Count
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* === INVENTORY & ETA HEADER (AUTOMATED) === */}
        <div className="w-full p-5 rounded-xl bg-black/30 border border-border/30 backdrop-blur-md">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Store Inventory Intelligence
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Automated calculations based on order history</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-card/50 border border-border/50">
              <p className="text-xs text-muted-foreground">Estimated Inventory</p>
              <p className="text-xl font-bold text-foreground">
                {tubeHeaderStats?.estimatedInventory?.toLocaleString() || 0} tubes
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/50">
              <p className="text-xs text-muted-foreground">ETA Until Restock</p>
              <p className="text-xl font-bold text-foreground">
                {tubeHeaderStats?.etaPrediction || 0} days
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/50">
              <p className="text-xs text-muted-foreground">Total Boxes Sold</p>
              <p className="text-xl font-bold text-foreground">
                {tubeHeaderStats?.totalBoxes?.toLocaleString() || 0}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/50">
              <p className="text-xs text-muted-foreground">Total Tubes Sold</p>
              <p className="text-xl font-bold text-foreground">
                {tubeHeaderStats?.totalTubes?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        {/* === TABS === */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full bg-slate-900/50">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="tubes" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Tube Intel</span>
            </TabsTrigger>
            <TabsTrigger value="reliability" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Reliability</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              <span className="hidden sm:inline">Notes</span>
            </TabsTrigger>
          </TabsList>

          {/* === OVERVIEW TAB (Dashboard) === */}
          <TabsContent value="overview" className="space-y-6">
            {/* Row 1: Tube Intelligence + Payment Summary */}
            <div className="grid lg:grid-cols-2 gap-6">
              <TubeIntelligencePanel companyId={id!} />
              <PaymentSummaryPanel companyId={id!} />
            </div>

            {/* Row 2: Brand Breakdown Cards */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                BRAND BREAKDOWN
              </h3>
              <BrandBreakdownCards companyId={id!} />
            </div>

            {/* Row 3: Recent Invoices + Recent Orders */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Invoices */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Latest Invoices
                    </span>
                    <Badge variant="outline">{invoices?.length || 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentInvoices.length > 0 ? (
                    recentInvoices.map((invoice) => {
                      const daysOverdue = invoice.due_date && invoice.payment_status !== 'paid'
                        ? Math.max(0, differenceInDays(new Date(), new Date(invoice.due_date)))
                        : 0;
                      const brandGradient = brandGradients[invoice.brand] || '';

                      return (
                        <div 
                          key={invoice.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r ${brandGradient || 'bg-muted/30'}`}
                        >
                          <div>
                            <p className="font-medium text-sm">{invoice.invoice_number || 'Invoice'}</p>
                            <p className="text-xs text-muted-foreground capitalize">{(invoice.brand || '').replace('_', ' ')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${(Number(invoice.total) || 0).toLocaleString()}</p>
                            <Badge 
                              variant={invoice.payment_status === 'paid' ? 'default' : 'destructive'} 
                              className="text-xs"
                            >
                              {invoice.payment_status}
                              {daysOverdue > 0 && ` (${daysOverdue}d late)`}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No invoices yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Recent Orders */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Latest Orders
                    </span>
                    <Badge variant="outline">{orders?.length || 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentOrders.length > 0 ? (
                    recentOrders.map((order) => {
                      const brandGradient = brandGradients[order.brand] || '';
                      return (
                        <div 
                          key={order.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r ${brandGradient || 'bg-muted/30'}`}
                        >
                          <div>
                            <p className="font-medium text-sm capitalize">{(order.brand || 'Order').replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.boxes} boxes • {order.tubes_total || (order.boxes || 0) * 100} tubes
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${(Number(order.total) || 0).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.created_at && format(new Date(order.created_at), 'MMM d')}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No orders yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button className="bg-gradient-to-r from-emerald-600 to-emerald-500">
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </Button>
              <Button variant="outline">
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
              <Button variant="outline">
                <MessageCircle className="h-4 w-4 mr-2" />
                Message
              </Button>
            </div>
          </TabsContent>

          {/* === CONTACTS TAB === */}
          <TabsContent value="contacts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Contacts ({contacts?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contacts && contacts.length > 0 ? (
                  contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{contact.name}</p>
                          {contact.is_primary && <Badge variant="secondary">Primary</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">{contact.role}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm">
                          {contact.phone && <p>{contact.phone}</p>}
                          {contact.email && <p className="text-muted-foreground">{contact.email}</p>}
                        </div>
                        <div className="flex gap-2">
                          {contact.phone && (
                            <Button size="icon" variant="outline" className="h-8 w-8">
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="outline" className="h-8 w-8">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No contacts found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ORDERS TAB === */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Orders ({orders?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orders && orders.length > 0 ? (
                  orders.map((order) => {
                    const brandGradient = brandGradients[order.brand] || '';
                    return (
                      <div key={order.id} className={`flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r ${brandGradient || 'bg-card'}`}>
                        <div>
                          <p className="font-medium capitalize">{(order.brand || 'Order').replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.boxes} boxes • {order.tubes_total || (order.boxes || 0) * 100} tubes
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.created_at && format(new Date(order.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">${(Number(order.total) || Number(order.subtotal) || 0).toLocaleString()}</p>
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                            {order.status || 'pending'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-center py-8">No orders found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === INVOICES TAB === */}
          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoices ({invoices?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices && invoices.length > 0 ? (
                  invoices.map((invoice) => {
                    const daysOverdue = invoice.due_date && invoice.payment_status !== 'paid'
                      ? Math.max(0, differenceInDays(new Date(), new Date(invoice.due_date)))
                      : 0;
                    const brandGradient = brandGradients[invoice.brand] || '';

                    return (
                      <div key={invoice.id} className={`flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r ${brandGradient || 'bg-card'} ${daysOverdue > 0 ? 'ring-2 ring-red-500/50' : ''}`}>
                        <div>
                          <p className="font-medium">{invoice.invoice_number || 'Invoice'}</p>
                          <p className="text-sm text-muted-foreground capitalize">{(invoice.brand || '').replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Due: {invoice.due_date && format(new Date(invoice.due_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div>
                            <p className="text-xl font-bold">${(Number(invoice.total) || Number(invoice.total_amount) || 0).toLocaleString()}</p>
                            <Badge variant={invoice.payment_status === 'paid' ? 'default' : invoice.payment_status === 'partial' ? 'secondary' : 'destructive'}>
                              {invoice.payment_status}
                              {daysOverdue > 0 && ` (${daysOverdue}d)`}
                            </Badge>
                          </div>
                          {invoice.payment_status !== 'paid' && (
                            <div className="flex flex-col gap-1">
                              <Button size="sm" variant="default" className="text-xs h-7">Mark Paid</Button>
                              <Button size="sm" variant="outline" className="text-xs h-7">Partial</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-center py-8">No invoices found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === PAYMENTS TAB === */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payments ({payments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payments && payments.length > 0 ? (
                  payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                      <div>
                        <p className="font-medium">${(Number(payment.paid_amount) || 0).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground capitalize">{payment.payment_method || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {payment.issue_date ? format(new Date(payment.issue_date), 'MMM d, yyyy') : (payment.created_at && format(new Date(payment.created_at), 'MMM d, yyyy'))}
                        </p>
                      </div>
                      <Badge variant={payment.payment_status === 'paid' ? 'default' : 'secondary'}>
                        {payment.payment_status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No payments found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TUBE ANALYTICS TAB === */}
          <TabsContent value="tubes" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Tube & Brand Intelligence</h2>
              <p className="text-xs text-muted-foreground">
                Live breakdown of all GasMask & Grabba brand movement for this company.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left: TubeMathEngine full analytics */}
              <div className="lg:col-span-2">
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/60 via-slate-900/60 to-black/80 p-4 md:p-6 shadow-lg shadow-black/40">
                  <TubeMathEngine companyId={id!} />
                </div>
              </div>

              {/* Right: Neighborhood intelligence */}
              <div className="lg:col-span-1">
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/60 via-slate-900/60 to-black/80 p-4 md:p-6 shadow-lg shadow-black/40">
                  <h3 className="text-sm font-medium mb-2">Neighborhood Snapshot</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    How this company's area performs across all stores and brands.
                  </p>

                  {(!company.neighborhood && !company.boro) ? (
                    <div className="text-xs text-muted-foreground py-4 text-center">
                      No neighborhood / boro saved yet. Add it to unlock area intelligence.
                    </div>
                  ) : (
                    <NeighborhoodIntelligence
                      neighborhood={company.neighborhood || undefined}
                      boro={company.boro || undefined}
                    />
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* === PAYMENT RELIABILITY TAB === */}
          <TabsContent value="reliability" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Payment Reliability & Risk</h2>
              <p className="text-xs text-muted-foreground">
                Score, behavior, and risk profile built from invoices + payments.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/60 via-slate-900/60 to-black/80 p-4 md:p-6 shadow-lg shadow-black/40">
              <PaymentReliabilityPanel companyId={id!} />
            </div>

            {/* Info pills */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-emerald-300/80 mb-1">
                  On-Time Behavior
                </p>
                <p className="text-xs text-muted-foreground">
                  Use this score to decide who gets priority delivery, new flavors first, and better credit terms.
                </p>
              </div>
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-yellow-300/80 mb-1">
                  Watch List
                </p>
                <p className="text-xs text-muted-foreground">
                  Stores with many late / unpaid invoices should be flagged for cash-only or shorter refill cycles.
                </p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-red-300/80 mb-1">
                  Risk Guardrails
                </p>
                <p className="text-xs text-muted-foreground">
                  Your drivers and team can check this tab before extending credit or dropping big orders.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* === NOTES TAB === */}
          <TabsContent value="notes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <StickyNote className="h-5 w-5" />
                  Notes & Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.tags && company.tags.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex gap-2 flex-wrap">
                      {company.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Notes</p>
                  <div className="p-4 bg-muted/50 rounded-lg min-h-[100px]">
                    {company.notes || 'No notes'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
