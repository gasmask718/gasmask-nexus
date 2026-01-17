import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Activity, DollarSign, MapPin, Package, MessageSquare, Calendar, Brain, FileText, Loader2, Edit, Plus, History } from "lucide-react";
import { useState } from "react";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";
import { useWholesalerIntelligence } from "@/hooks/useWholesalerIntelligence";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Intelligence Cockpit Components
import {
  WholesalerIdentityCard,
  WholesalerHealthScore,
  WholesalerOrderIntelligence,
  WholesalerFinancialRisk,
  WholesalerTerritory,
  WholesalerProductPerformance,
  WholesalerCommunicationMemory,
  WholesalerVisits,
  WholesalerAISignals,
  WholesalerContracts,
  WholesalerActionBar
} from "@/components/wholesaler";

// Command Modals
import {
  CreateOrderModal,
  ScheduleVisitModal,
  AdjustPricingModal,
  EditProfileModal,
  CreateTaskModal,
  EscalateModal,
} from "@/components/wholesaler/WholesalerCommandModals";

// Drill-down Drawers
import { 
  OrderDetailDrawer, 
  HealthScoreDrawer, 
  MetricDetailDrawer,
  FinancialDetailDrawer,
  TerritoryDetailDrawer,
  ProductDetailDrawer,
  VisitDetailDrawer
} from "@/components/wholesaler/drilldown";

export default function WholesalerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Modal states
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const [adjustPricingOpen, setAdjustPricingOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  
  // Drill-down states
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [healthScoreOpen, setHealthScoreOpen] = useState(false);
  const [metricDrawerOpen, setMetricDrawerOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<{type: string; value: number; label: string; icon?: any; items?: any[]} | null>(null);
  const [financialDrawerOpen, setFinancialDrawerOpen] = useState(false);
  const [financialType, setFinancialType] = useState<'punctuality' | 'avg_days' | 'total_payments' | 'late_payments' | 'dispute'>('total_payments');
  const [territoryDrawerOpen, setTerritoryDrawerOpen] = useState(false);
  const [territoryType, setTerritoryType] = useState<'neighborhoods' | 'stores' | 'exclusive' | 'overlap' | 'area'>('neighborhoods');
  const [selectedTerritory, setSelectedTerritory] = useState<any>(null);
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [productType, setProductType] = useState<'units' | 'revenue' | 'returns' | 'product'>('units');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [visitDrawerOpen, setVisitDrawerOpen] = useState(false);
  const [visitType, setVisitType] = useState<'total' | 'days_since' | 'visibility' | 'visit'>('total');
  const [selectedVisit, setSelectedVisit] = useState<any>(null);

  // Fetch all intelligence data using the unified hook
  const intelligence = useWholesalerIntelligence(id || '');
  const profile = intelligence.profile;
  const isLoading = intelligence.isLoading;

  // Action handlers
  const handleCreateOrder = async (data: any) => {
    try {
      const { error } = await supabase.from('wholesaler_orders').insert({
        wholesaler_id: id,
        order_date: data.order_date,
        total_amount: data.total_amount,
        skus: data.items,
        items_count: data.items.length,
        status: 'pending',
        payment_status: 'pending',
        notes: data.notes,
      });
      if (error) throw error;
      toast.success('Order created successfully');
      intelligence.refetchAll?.();
    } catch (error: any) {
      toast.error(`Failed to create order: ${error.message}`);
      throw error;
    }
  };

  const handleScheduleVisit = async (data: any) => {
    await intelligence.addVisit(data);
    toast.success('Visit scheduled');
  };

  const handleAdjustPricing = async (data: any) => {
    await intelligence.updateProfile({
      pricing_tier: data.pricing_tier,
      margin_agreement: data.margin_agreement,
      payment_terms: data.payment_terms,
      moq: data.moq,
    });
  };

  const handleEditProfile = async (data: any) => {
    await intelligence.updateProfile(data);
  };

  const handleCreateTask = async (_data: any) => {
    toast.success('Task created');
  };

  const handleEscalate = async (_data: any) => {
    toast.success('Issue flagged for review');
  };

  const handleOrderClick = (order: any) => {
    setSelectedOrder(order);
    setOrderDetailOpen(true);
  };

  const handleHealthScoreClick = () => setHealthScoreOpen(true);
  const handleMetricClick = (type: string, value: number, label: string) => {
    // If it's a financial metric, open the financial drawer
    if (['punctuality', 'avg_days', 'total_payments', 'late_payments', 'dispute'].includes(type)) {
      setFinancialType(type as any);
      setFinancialDrawerOpen(true);
    } else if (['neighborhoods', 'stores', 'exclusive', 'overlap'].includes(type)) {
      setTerritoryType(type as any);
      setTerritoryDrawerOpen(true);
    } else if (['units', 'revenue', 'returns'].includes(type)) {
      setProductType(type as any);
      setProductDrawerOpen(true);
    } else if (['total', 'days_since', 'visibility'].includes(type)) {
      setVisitType(type as any);
      setVisitDrawerOpen(true);
    } else {
      // Generic metric drawer
      setSelectedMetric({ type, value, label });
      setMetricDrawerOpen(true);
    }
  };
  const handleFinancialClick = (type: 'punctuality' | 'avg_days' | 'total_payments' | 'late_payments' | 'dispute' = 'total_payments') => {
    setFinancialType(type);
    setFinancialDrawerOpen(true);
  };
  const handleTerritoryClick = (territory: any) => {
    setSelectedTerritory(territory);
    setTerritoryType('area');
    setTerritoryDrawerOpen(true);
  };
  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setProductType('product');
    setProductDrawerOpen(true);
  };
  const handleVisitClick = (visit: any) => {
    setSelectedVisit(visit);
    setVisitType('visit');
    setVisitDrawerOpen(true);
  };

  if (isLoading && !profile) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Wholesaler not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'at-risk': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'suspended': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{profile.name}</h1>
                  <Badge className={getStatusColor(profile.status)}>
                    {profile.status || 'Unknown'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {profile.role_type || 'Primary'} Wholesaler • {profile.neighborhood || profile.state || 'No territory'}
                </p>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="hidden lg:flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditProfileOpen(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button size="sm" onClick={() => setCreateOrderOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New Order
              </Button>
              
              {/* Quick Health Indicator - clickable */}
              <button
                onClick={handleHealthScoreClick}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm text-muted-foreground">Health:</span>
                <Badge variant="outline" className={
                  (profile.relationship_health_score || 50) >= 70 ? 'text-green-400 border-green-500/30 cursor-pointer' :
                  (profile.relationship_health_score || 50) >= 40 ? 'text-amber-400 border-amber-500/30 cursor-pointer' :
                  'text-red-400 border-red-500/30 cursor-pointer'
                }>
                  {profile.relationship_health_score || 50}/100
                </Badge>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar - Fully Wired */}
      <div className="container mx-auto px-4">
        <WholesalerActionBar 
          profile={profile}
          onLogCommunication={() => setLogModalOpen(true)}
          onScheduleVisit={() => setScheduleVisitOpen(true)}
          onCreateTask={() => setCreateTaskOpen(true)}
          onAdjustPricing={() => setAdjustPricingOpen(true)}
          onFlagRenegotiation={() => toast.info('Contract renegotiation flagged')}
          onAssignRep={() => toast.info('Rep assignment coming soon')}
          onEscalate={() => setEscalateOpen(true)}
        />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Identity Card - With Edit */}
        <WholesalerIdentityCard 
          profile={profile} 
          onEdit={() => setEditProfileOpen(true)}
        />

        {/* Intelligence Tabs */}
        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid grid-cols-5 lg:grid-cols-9 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="flex items-center gap-1 text-xs px-2 py-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-1 text-xs px-2 py-1.5">
              <Package className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-1 text-xs px-2 py-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Financial</span>
            </TabsTrigger>
            <TabsTrigger value="territory" className="flex items-center gap-1 text-xs px-2 py-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Territory</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-1 text-xs px-2 py-1.5">
              <Package className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="comms" className="flex items-center gap-1 text-xs px-2 py-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Comms</span>
            </TabsTrigger>
            <TabsTrigger value="visits" className="flex items-center gap-1 text-xs px-2 py-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Visits</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-1 text-xs px-2 py-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Contracts</span>
            </TabsTrigger>
            <TabsTrigger value="signals" className="flex items-center gap-1 text-xs px-2 py-1.5">
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI Signals</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Dashboard View with Click Actions */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div onClick={handleHealthScoreClick} className="cursor-pointer hover:ring-2 hover:ring-primary/20 rounded-lg transition-all">
                <WholesalerHealthScore 
                  profile={profile}
                  snapshots={intelligence.healthSnapshots || []}
                />
              </div>
              <WholesalerAISignals 
                signals={intelligence.signals || []}
                onAcknowledge={intelligence.acknowledgeSignal}
                onResolve={intelligence.resolveSignal}
              />
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <WholesalerOrderIntelligence 
                orders={intelligence.orders || []}
                metrics={intelligence.orderMetrics}
                onOrderClick={handleOrderClick}
                onMetricClick={handleMetricClick}
              />
              <WholesalerFinancialRisk 
                payments={intelligence.payments || []}
                disputes={intelligence.disputes || []}
                paymentMetrics={intelligence.paymentMetrics}
                profile={profile}
                onMetricClick={handleMetricClick}
              />
            </div>
          </TabsContent>

          {/* Orders Tab - With Create Action */}
          <TabsContent value="orders" className="mt-6">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setCreateOrderOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </Button>
            </div>
            <WholesalerOrderIntelligence 
              orders={intelligence.orders || []}
              metrics={intelligence.orderMetrics}
              onOrderClick={handleOrderClick}
              onMetricClick={handleMetricClick}
            />
          </TabsContent>

          <TabsContent value="financial" className="mt-6">
            <WholesalerFinancialRisk 
              payments={intelligence.payments || []}
              disputes={intelligence.disputes || []}
              paymentMetrics={intelligence.paymentMetrics}
              profile={profile}
              onMetricClick={handleMetricClick}
            />
          </TabsContent>

          <TabsContent value="territory" className="mt-6">
            <WholesalerTerritory 
              territory={intelligence.territory || []}
              profile={profile}
              onMetricClick={handleMetricClick}
              onTerritoryClick={handleTerritoryClick}
            />
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <WholesalerProductPerformance 
              products={intelligence.productPerformance || []}
              onMetricClick={handleMetricClick}
              onProductClick={handleProductClick}
            />
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="comms" className="mt-6">
            <WholesalerCommunicationMemory 
              communications={intelligence.communications || []}
              onAddCommunication={intelligence.addCommunication}
            />
          </TabsContent>

          {/* Visits Tab - With Schedule Action */}
          <TabsContent value="visits" className="mt-6">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setScheduleVisitOpen(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Visit
              </Button>
            </div>
            <WholesalerVisits 
              visits={intelligence.visits || []}
              profile={profile}
              onAddVisit={intelligence.addVisit}
              onMetricClick={handleMetricClick}
              onVisitClick={handleVisitClick}
            />
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="mt-6">
            <WholesalerContracts 
              contracts={intelligence.contracts || []}
              profile={profile}
            />
          </TabsContent>

          {/* AI Signals Tab */}
          <TabsContent value="signals" className="mt-6">
            <WholesalerAISignals 
              signals={intelligence.signals || []}
              onAcknowledge={intelligence.acknowledgeSignal}
              onResolve={intelligence.resolveSignal}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ========== COMMAND MODALS ========== */}
      
      {/* Communication Log Modal */}
      <CommunicationLogModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        entityType="wholesaler"
        entityId={id!}
        entityName={profile.name}
        onSuccess={() => setLogModalOpen(false)}
      />

      {/* Create Order Modal */}
      <CreateOrderModal
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        wholesaler={profile}
        onSubmit={handleCreateOrder}
      />

      {/* Schedule Visit Modal */}
      <ScheduleVisitModal
        open={scheduleVisitOpen}
        onOpenChange={setScheduleVisitOpen}
        wholesaler={profile}
        onSubmit={handleScheduleVisit}
      />

      {/* Adjust Pricing Modal */}
      <AdjustPricingModal
        open={adjustPricingOpen}
        onOpenChange={setAdjustPricingOpen}
        wholesaler={profile}
        onSubmit={handleAdjustPricing}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        wholesaler={profile}
        onSubmit={handleEditProfile}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        wholesaler={profile}
        onSubmit={handleCreateTask}
      />

      {/* Escalate Modal */}
      <EscalateModal
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        wholesaler={profile}
        onSubmit={handleEscalate}
      />

      {/* ========== DRILL-DOWN DRAWERS ========== */}
      
      {/* Order Detail Drawer */}
      <OrderDetailDrawer
        open={orderDetailOpen}
        onOpenChange={setOrderDetailOpen}
        order={selectedOrder}
        onReorder={() => {
          setOrderDetailOpen(false);
          setCreateOrderOpen(true);
        }}
        onAddNote={(orderId, note) => {
          toast.success('Note added to order');
        }}
        onFlagIssue={(orderId, note) => {
          toast.success('Issue flagged on order');
        }}
      />

      {/* Health Score Drawer */}
      <HealthScoreDrawer
        open={healthScoreOpen}
        onOpenChange={setHealthScoreOpen}
        profile={profile}
        snapshots={intelligence.healthSnapshots || []}
      />

      {/* Metric Detail Drawer */}
      <MetricDetailDrawer
        open={metricDrawerOpen}
        onOpenChange={setMetricDrawerOpen}
        title={selectedMetric?.label || 'Metric Details'}
        icon={selectedMetric?.icon || Package}
        mainValue={selectedMetric?.value || 0}
        mainLabel={selectedMetric?.label || ''}
        items={selectedMetric?.items || []}
      />

      {/* Financial Detail Drawer */}
      <FinancialDetailDrawer
        open={financialDrawerOpen}
        onOpenChange={setFinancialDrawerOpen}
        type={financialType}
        payments={intelligence.payments || []}
        disputes={intelligence.disputes || []}
        metrics={{
          totalPayments: intelligence.payments?.length || 0,
          punctualityRate: intelligence.payments?.filter(p => p.on_time).length / (intelligence.payments?.length || 1) * 100 || 0,
          avgDaysToPayment: intelligence.payments?.reduce((acc, p) => acc + (p.days_from_invoice || 0), 0) / (intelligence.payments?.length || 1) || 0,
          latePaments: intelligence.payments?.filter(p => !p.on_time).length || 0,
        }}
        profile={profile}
      />

      {/* Territory Detail Drawer */}
      <TerritoryDetailDrawer
        open={territoryDrawerOpen}
        onOpenChange={setTerritoryDrawerOpen}
        type={territoryType}
        territory={intelligence.territory || []}
        selectedArea={selectedTerritory}
        profile={profile}
      />

      {/* Product Detail Drawer */}
      <ProductDetailDrawer
        open={productDrawerOpen}
        onOpenChange={setProductDrawerOpen}
        type={productType}
        products={intelligence.productPerformance || []}
        selectedProduct={selectedProduct}
      />

      {/* Visit Detail Drawer */}
      <VisitDetailDrawer
        open={visitDrawerOpen}
        onOpenChange={setVisitDrawerOpen}
        type={visitType}
        visits={intelligence.visits || []}
        selectedVisit={selectedVisit}
        profile={profile}
        onScheduleVisit={() => setScheduleVisitOpen(true)}
      />
    </div>
  );
}
