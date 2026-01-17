import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Activity, DollarSign, MapPin, Package, MessageSquare, Calendar, Brain, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";
import { useWholesalerIntelligence } from "@/hooks/useWholesalerIntelligence";

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

export default function WholesalerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [logModalOpen, setLogModalOpen] = useState(false);

  // Fetch all intelligence data using the unified hook
  const intelligence = useWholesalerIntelligence(id || '');
  const profile = intelligence.profile;
  const isLoading = intelligence.isLoading;

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
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
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

            {/* Quick Health Indicator - compact view */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Health:</span>
                <Badge variant="outline" className={
                  (profile.relationship_health_score || 50) >= 70 ? 'text-green-400 border-green-500/30' :
                  (profile.relationship_health_score || 50) >= 40 ? 'text-amber-400 border-amber-500/30' :
                  'text-red-400 border-red-500/30'
                }>
                  {profile.relationship_health_score || 50}/100
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="container mx-auto px-4">
        <WholesalerActionBar 
          profile={profile}
          onLogCommunication={() => setLogModalOpen(true)}
        />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Identity Card - Always Visible */}
        <WholesalerIdentityCard profile={profile} />

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

          {/* Overview Tab - Dashboard View */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <WholesalerHealthScore 
                profile={profile}
                snapshots={intelligence.healthSnapshots || []}
              />
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
              />
              <WholesalerFinancialRisk 
                payments={intelligence.payments || []}
                disputes={intelligence.disputes || []}
                paymentMetrics={intelligence.paymentMetrics}
                profile={profile}
              />
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-6">
            <WholesalerOrderIntelligence 
              orders={intelligence.orders || []}
              metrics={intelligence.orderMetrics}
            />
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="mt-6">
            <WholesalerFinancialRisk 
              payments={intelligence.payments || []}
              disputes={intelligence.disputes || []}
              paymentMetrics={intelligence.paymentMetrics}
              profile={profile}
            />
          </TabsContent>

          {/* Territory Tab */}
          <TabsContent value="territory" className="mt-6">
            <WholesalerTerritory 
              territory={intelligence.territory || []}
              profile={profile}
            />
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-6">
            <WholesalerProductPerformance 
              products={intelligence.productPerformance || []}
            />
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="comms" className="mt-6">
            <WholesalerCommunicationMemory 
              communications={intelligence.communications || []}
              onAddCommunication={intelligence.addCommunication}
            />
          </TabsContent>

          {/* Visits Tab */}
          <TabsContent value="visits" className="mt-6">
            <WholesalerVisits 
              visits={intelligence.visits || []}
              profile={profile}
              onAddVisit={intelligence.addVisit}
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

      {/* Communication Log Modal */}
      <CommunicationLogModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        entityType="wholesaler"
        entityId={id!}
        entityName={profile.name}
        onSuccess={() => setLogModalOpen(false)}
      />
    </div>
  );
}
