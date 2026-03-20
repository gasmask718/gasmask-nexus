import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RouteAssignmentDialog } from "@/components/delivery/RouteAssignmentDialog";
import { DispatchIntakePanel } from "@/components/delivery/DispatchIntakePanel";
import { AISuggestionsPanel } from "@/components/delivery/AISuggestionsPanel";
import type { AIRecommendation } from "@/hooks/useAIDispatchSuggestions";
import type { DispatchSignal } from "@/hooks/useDispatchIntakeView";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ArrowLeft, 
  Search, 
  Package, 
  MapPin, 
  Truck, 
  Merge, 
  Split, 
  Send,  // kept for future use
  Filter,
  Building2,
  TrendingUp,
  AlertTriangle,
  FileText,
  Zap,
  DollarSign,
  CheckCircle2,
  XCircle,
  Info,
  History,
  Route,
  Navigation
} from "lucide-react";
import { toast } from "sonner";
import { 
  useMultiBrandIntelligence, 
  calculateCBRE, 
  detectConflicts,
  CBRE_THRESHOLDS,
  type InvoiceAtStop 
} from "@/hooks/useMultiBrandIntelligence";
import { 
  useIntelligenceHistory,
  createIntelligenceSnapshot 
} from "@/hooks/useIntelligenceHistory";
import { 
  AcknowledgeButton,
  AcknowledgmentBadge,
  ReviewedCardWrapper,
  HistoryTimelineIndicator,
  TodayIntelligenceSummary
} from "@/components/delivery";

const BRANDS = ["GasMask", "Hot Mama", "Hot Scalati", "Grabba R Us"];

interface DeliveryItem {
  id: string;
  store_id: string;
  store_name: string;
  store_city?: string;
  brand: string;
  quantity: number;
  priority: string;
  status: string;
  invoice_id?: string;
  invoice_status?: 'paid' | 'unpaid' | 'partial';
  invoice_amount?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CBRE DISPLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function CBREDisplay({ cbre }: { cbre: ReturnType<typeof calculateCBRE> }) {
  const ratingBadge = {
    excellent: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/30' },
    acceptable: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500/30' },
    inefficient: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30' },
  }[cbre.rating];

  return (
    <Card className="border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Cross-Brand Route Efficiency (CBRE)
        </CardTitle>
        <CardDescription>
          How much work saved by multi-brand consolidation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-3xl font-bold ${cbre.ratingColor}`}>
              {cbre.efficiencyGain}%
            </div>
            <div className="text-sm text-muted-foreground">
              efficiency gain
            </div>
          </div>
          <div className="text-right">
            <Badge 
              variant="outline" 
              className={`${ratingBadge.bg} ${ratingBadge.text} ${ratingBadge.border} capitalize`}
            >
              {cbre.rating}
            </Badge>
            <div className="text-xs text-muted-foreground mt-1">
              {cbre.actualStops} actual / {cbre.theoreticalStops} theoretical
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full ${cbre.rating === 'excellent' ? 'bg-green-500' : cbre.rating === 'acceptable' ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(100, cbre.efficiencyGain)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0%</span>
          <span>30% (excellent)</span>
          <span>50%+</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFLICT FLAGS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function ConflictFlags({ conflicts }: { conflicts: ReturnType<typeof detectConflicts> }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {conflicts.map((conflict, idx) => (
        <TooltipProvider key={idx}>
          <Tooltip>
            <TooltipTrigger>
              <Badge 
                variant={conflict.severity === 'error' ? 'destructive' : 'outline'}
                className={conflict.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' : ''}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {conflict.type.replace(/_/g, ' ')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{conflict.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Brands: {conflict.brands.join(', ')}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSIGHTS PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function InsightsPanel({ insights }: { insights: ReturnType<typeof useMultiBrandIntelligence>['insights'] }) {
  const navigate = useNavigate();
  
  const getIcon = (type: string, severity: string) => {
    if (severity === 'success') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (severity === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <Info className="h-4 w-4 text-blue-600" />;
  };

  const getBg = (severity: string) => {
    if (severity === 'success') return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
    if (severity === 'error') return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
    if (severity === 'warning') return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
    return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
  };

  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Intelligence Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, idx) => (
          <div 
            key={idx} 
            className={`p-3 rounded-lg border ${getBg(insight.severity)} flex items-center justify-between gap-2`}
          >
            <div className="flex items-center gap-2">
              {getIcon(insight.type, insight.severity)}
              <span className="text-sm">{insight.message}</span>
            </div>
            {insight.actionLabel && insight.actionPath && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(insight.actionPath!)}
              >
                {insight.actionLabel}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE SUMMARY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function InvoiceSummaryCard({ summary }: { summary: ReturnType<typeof useMultiBrandIntelligence>['invoiceSummary'] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Invoice Linkage
        </CardTitle>
        <CardDescription>
          Financial awareness for delivery stops
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold">{summary.totalInvoices}</div>
            <div className="text-xs text-muted-foreground">Total Invoices</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{summary.byStatus.paid}</div>
            <div className="text-xs text-muted-foreground">Paid</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-destructive">{summary.byStatus.unpaid}</div>
            <div className="text-xs text-muted-foreground">Unpaid</div>
          </div>
        </div>
        {summary.unpaidAmount > 0 && (
          <div className="mt-3 p-2 bg-destructive/10 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                ${summary.unpaidAmount.toLocaleString()} unpaid on route
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MultiBrandDeliveryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("deliveries");

  // Fetch pending delivery items
  const { data: deliveryItems = [], isLoading } = useQuery({
    queryKey: ["multi-brand-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_product_state")
        .select(`
          id,
          store_id,
          brand,
          stock_level,
          urgency_score,
          stores(name, address_city)
        `)
        .gt("urgency_score", 0)
        .order("urgency_score", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Simulate invoice data for demonstration
      return data.map((item: any, idx: number) => ({
        id: item.id,
        store_id: item.store_id,
        store_name: item.stores?.name || "Unknown Store",
        store_city: item.stores?.address_city,
        brand: item.brand || "GasMask",
        quantity: Math.max(1, 10 - (item.stock_level || 0)),
        priority: item.urgency_score > 7 ? "urgent" : item.urgency_score > 4 ? "high" : "normal",
        status: "pending",
        // Simulated invoice data
        invoice_id: `INV-${1000 + idx}`,
        invoice_status: idx % 3 === 0 ? 'paid' : idx % 3 === 1 ? 'unpaid' : 'partial' as const,
        invoice_amount: Math.round((item.urgency_score || 1) * 150),
      })) as DeliveryItem[];
    },
  });

  // Group by store for stop-level analysis
  const stopsForAnalysis = useMemo(() => {
    const groups = new Map<string, { 
      store_id: string; 
      store_name: string; 
      brands: string[];
      invoices: InvoiceAtStop[];
    }>();
    
    deliveryItems.forEach((item) => {
      if (!groups.has(item.store_id)) {
        groups.set(item.store_id, {
          store_id: item.store_id,
          store_name: item.store_name,
          brands: [],
          invoices: [],
        });
      }
      const group = groups.get(item.store_id)!;
      if (!group.brands.includes(item.brand)) {
        group.brands.push(item.brand);
      }
      if (item.invoice_id) {
        group.invoices.push({
          invoice_id: item.invoice_id,
          brand: item.brand,
          amount: item.invoice_amount || 0,
          status: item.invoice_status || 'unpaid',
        });
      }
    });
    
    return Array.from(groups.values());
  }, [deliveryItems]);

  // Use intelligence hook
  const intelligence = useMultiBrandIntelligence({
    stops: stopsForAnalysis,
    pendingDeliveries: deliveryItems.map(d => ({ store_id: d.store_id, brand: d.brand })),
  });

  // Use history tracking hook (Phase 3.25)
  const aggregatedRouteId = 'multi-brand-aggregate'; // Aggregate view uses single ID
  const { 
    todayStats, 
    history,
    acknowledge, 
    isAcknowledging,
    recordSnapshot 
  } = useIntelligenceHistory(aggregatedRouteId);

  // Check if today's intelligence has been acknowledged
  const todayAcknowledged = useMemo(() => {
    if (!history || history.length === 0) return false;
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = history.find(h => h.recorded_date === today);
    return !!todayRecord?.acknowledged_at;
  }, [history]);

  // Record snapshot when intelligence changes (debounced)
  useEffect(() => {
    if (stopsForAnalysis.length > 0 && intelligence.cbre) {
      const allConflicts = Array.from(intelligence.conflictsByStop.values()).flat();
      const snapshot = createIntelligenceSnapshot(
        aggregatedRouteId,
        intelligence.cbre,
        allConflicts,
        intelligence.invoiceSummary
      );
      recordSnapshot(snapshot);
    }
  }, [stopsForAnalysis.length, intelligence.cbre?.cbre]);

  const handleAcknowledge = (note?: string) => {
    acknowledge({ routeId: aggregatedRouteId, note });
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return deliveryItems.filter((item) => {
      const matchesSearch = 
        item.store_name.toLowerCase().includes(search.toLowerCase()) ||
        item.brand.toLowerCase().includes(search.toLowerCase());
      const matchesBrand = brandFilter === "all" || item.brand === brandFilter;
      return matchesSearch && matchesBrand;
    });
  }, [deliveryItems, search, brandFilter]);

  // Get unique stores from filtered items
  const filteredStores = useMemo(() => {
    const storeMap = new Map<string, { 
      store_id: string; 
      store_name: string; 
      store_city?: string; 
      items: DeliveryItem[];
      conflicts: ReturnType<typeof detectConflicts>;
    }>();
    
    filteredItems.forEach((item) => {
      if (!storeMap.has(item.store_id)) {
        storeMap.set(item.store_id, {
          store_id: item.store_id,
          store_name: item.store_name,
          store_city: item.store_city,
          items: [],
          conflicts: [],
        });
      }
      storeMap.get(item.store_id)!.items.push(item);
    });

    // Calculate conflicts for each store
    storeMap.forEach((store) => {
      const brands = [...new Set(store.items.map(i => i.brand))];
      store.conflicts = detectConflicts(brands);
    });

    return Array.from(storeMap.values());
  }, [filteredItems]);

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleStore = (storeId: string) => {
    const storeItems = filteredItems.filter((i) => i.store_id === storeId).map((i) => i.id);
    const allSelected = storeItems.every((id) => selectedItems.includes(id));
    
    if (allSelected) {
      setSelectedItems((prev) => prev.filter((id) => !storeItems.includes(id)));
    } else {
      setSelectedItems((prev) => [...new Set([...prev, ...storeItems])]);
    }
  };

  const selectAll = () => {
    setSelectedItems(filteredItems.map((i) => i.id));
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [aiPreselectedStores, setAiPreselectedStores] = useState<string[]>([]);
  const [aiBrandContext, setAiBrandContext] = useState<any[]>([]);

  const handleAISuggestionApply = (rec: AIRecommendation) => {
    // Pre-fill the RouteAssignmentDialog with AI recommendation
    setAiPreselectedStores([rec.store_id]);
    setAiBrandContext([{ store_id: rec.store_id }]);
    setAssignDialogOpen(true);
  };

  const handleDispatchSignalsSelected = (signals: DispatchSignal[]) => {
    // Pre-populate the existing assignmentContext with dispatch signals
    // This will be used when assigning routes
    const context = {
      storeIds: signals.map(s => s.store_id),
      brandStopContext: signals.map(s => ({
        store_id: s.store_id,
        opportunity_ids: s.sources.opportunity_ids,
      })),
      brands: [],
    };
    // We'll pass these signals into the route assignment dialog via props
    setAssignDialogOpen(true);
  };

  // Compute selected stores + brand context for assignment
  const assignmentContext = useMemo(() => {
    const selectedDeliveries = deliveryItems.filter((i) => selectedItems.includes(i.id));
    const storeIds = [...new Set(selectedDeliveries.map((i) => i.store_id))];
    const brands = [...new Set(selectedDeliveries.map((i) => i.brand))];
    const brandStopContext = storeIds.map(storeId => {
      const storeDeliveries = selectedDeliveries.filter(d => d.store_id === storeId);
      return {
        store_id: storeId,
        brand_id: storeDeliveries[0]?.brand,
        order_ids: storeDeliveries.map(d => d.invoice_id).filter(Boolean) as string[],
      };
    });
    return { storeIds, brands, brandStopContext };
  }, [selectedItems, deliveryItems]);

  const handleAssignRoute = () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one delivery item");
      return;
    }
    setAssignDialogOpen(true);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent": return <Badge variant="destructive">Urgent</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      default: return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getBrandColor = (brand: string) => {
    switch (brand) {
      case "GasMask": return "bg-purple-500/10 text-purple-600 border-purple-500/30";
      case "Hot Mama": return "bg-red-500/10 text-red-600 border-red-500/30";
      case "Hot Scalati": return "bg-orange-500/10 text-orange-600 border-orange-500/30";
      case "Grabba R Us": return "bg-green-500/10 text-green-600 border-green-500/30";
      default: return "bg-gray-500/10 text-gray-600";
    }
  };

  const getInvoiceStatusBadge = (status?: string) => {
    switch (status) {
      case 'paid': return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Paid</Badge>;
      case 'partial': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Partial</Badge>;
      case 'unpaid': return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Unpaid</Badge>;
      default: return null;
    }
  };

  // Stats
  const stats = {
    totalItems: filteredItems.length,
    totalStores: filteredStores.length,
    selectedItems: selectedItems.length,
    selectedStores: [...new Set(deliveryItems.filter((i) => selectedItems.includes(i.id)).map((i) => i.store_id))].length,
    byBrand: BRANDS.reduce((acc, brand) => {
      acc[brand] = filteredItems.filter((i) => i.brand === brand).length;
      return acc;
    }, {} as Record<string, number>),
    avgBrandsPerStop: filteredStores.length > 0 
      ? (filteredStores.reduce((sum, s) => sum + new Set(s.items.map(i => i.brand)).size, 0) / filteredStores.length).toFixed(1)
      : '0',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Multi-Brand Delivery Command
            </h1>
            <p className="text-muted-foreground">Brand-aware logistics with efficiency intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Acknowledgment Status + Action */}
          <div className="flex items-center gap-2">
            <HistoryTimelineIndicator 
              hasHistory={(history?.length || 0) > 0} 
              recordCount={history?.length || 0}
            />
            <AcknowledgmentBadge 
              acknowledged={todayAcknowledged}
              acknowledgedAt={history?.find(h => h.recorded_date === new Date().toISOString().split('T')[0])?.acknowledged_at || undefined}
            />
            {!todayAcknowledged && (
              <AcknowledgeButton
                acknowledged={todayAcknowledged}
                onAcknowledge={handleAcknowledge}
                isLoading={isAcknowledging}
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={selectedItems.length === 0}>
              <Split className="h-4 w-4 mr-2" />
              Split by Brand
            </Button>
            <Button variant="outline" disabled={selectedItems.length === 0}>
              <Merge className="h-4 w-4 mr-2" />
              Merge Deliveries
            </Button>
            <Button onClick={handleAssignRoute} disabled={selectedItems.length === 0}>
              <Truck className="h-4 w-4 mr-2" />
              Assign Route
            </Button>
          </div>
        </div>
      </div>

      {/* Phase 3.25: Today's Intelligence Summary */}
      <TodayIntelligenceSummary stats={todayStats} isLoading={!todayStats} />

      {/* Intelligence Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CBREDisplay cbre={intelligence.cbre} />
        <InvoiceSummaryCard summary={intelligence.invoiceSummary} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Conflict Summary
            </CardTitle>
            <CardDescription>
              Brand combination issues detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{intelligence.totalConflicts}</div>
                <div className="text-xs text-muted-foreground">Total Conflicts</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">{intelligence.criticalConflicts}</div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
            </div>
            {intelligence.piggybackOpportunities.length > 0 && (
              <div className="mt-3 p-2 bg-blue-500/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">
                    {intelligence.piggybackOpportunities.length} piggyback opportunities
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insights Panel */}
      <InsightsPanel insights={intelligence.insights} />

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="matrix">Brand Matrix</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities ({intelligence.piggybackOpportunities.length})</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch Intake</TabsTrigger>
          <TabsTrigger value="ai-suggestions" className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            AI Suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deliveries" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.totalStores}</div>
                <p className="text-xs text-muted-foreground">Total Stores</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.totalItems}</div>
                <p className="text-xs text-muted-foreground">Delivery Items</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.avgBrandsPerStop}</div>
                <p className="text-xs text-muted-foreground">Avg Brands/Stop</p>
              </CardContent>
            </Card>
            <Card className="border-primary/50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{stats.selectedStores}</div>
                <p className="text-xs text-muted-foreground">Selected Stores</p>
              </CardContent>
            </Card>
            <Card className="border-primary/50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{stats.selectedItems}</div>
                <p className="text-xs text-muted-foreground">Selected Items</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search stores or brands..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {BRANDS.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>

          {/* Stores List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading deliveries...</div>
          ) : filteredStores.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending deliveries found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredStores.map((store) => {
                const storeItemIds = store.items.map((i) => i.id);
                const allSelected = storeItemIds.every((id) => selectedItems.includes(id));
                const someSelected = storeItemIds.some((id) => selectedItems.includes(id));
                const hasConflicts = store.conflicts.length > 0;
                
                return (
                  <Card 
                    key={store.store_id} 
                    className={`${someSelected ? "border-primary/50" : ""} ${hasConflicts ? "border-l-4 border-l-yellow-500" : ""}`}
                  >
                    <CardHeader className="py-3">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={allSelected}
                          onCheckedChange={() => toggleStore(store.store_id)}
                        />
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {store.store_name}
                            <span className="text-sm font-normal text-muted-foreground">
                              {store.store_city && `• ${store.store_city}`}
                            </span>
                            {hasConflicts && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">Brand Conflicts Detected</p>
                                    {store.conflicts.map((c, i) => (
                                      <p key={i} className="text-xs">{c.message}</p>
                                    ))}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </CardTitle>
                        </div>
                        <div className="flex gap-1">
                          {[...new Set(store.items.map((i) => i.brand))].map((brand) => (
                            <Badge key={brand} variant="outline" className={getBrandColor(brand)}>
                              {brand}
                            </Badge>
                          ))}
                        </div>
                        <Badge variant="secondary">{store.items.length} items</Badge>
                      </div>
                      {store.conflicts.length > 0 && (
                        <div className="ml-10 mt-2">
                          <ConflictFlags conflicts={store.conflicts} />
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {store.items.map((item) => (
                          <div 
                            key={item.id}
                            className={`flex items-center gap-3 p-2 rounded-lg border ${
                              selectedItems.includes(item.id) ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                            }`}
                          >
                            <Checkbox 
                              checked={selectedItems.includes(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                            />
                            <Badge variant="outline" className={getBrandColor(item.brand)}>
                              {item.brand}
                            </Badge>
                            <span className="text-sm">Qty: {item.quantity}</span>
                            {getPriorityBadge(item.priority)}
                            {item.invoice_id && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {getInvoiceStatusBadge(item.invoice_status)}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Invoice: {item.invoice_id}</p>
                                    <p className="text-xs">${item.invoice_amount?.toLocaleString()}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="matrix">
          <Card>
            <CardHeader>
              <CardTitle>Brand → Store Matrix</CardTitle>
              <CardDescription>
                Visual representation of brand distribution across stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border-b">Store</th>
                      {BRANDS.map(brand => (
                        <th key={brand} className="text-center p-2 border-b">
                          <Badge variant="outline" className={getBrandColor(brand)}>
                            {brand}
                          </Badge>
                        </th>
                      ))}
                      <th className="text-center p-2 border-b">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.slice(0, 20).map(store => {
                      const brandCounts = BRANDS.reduce((acc, brand) => {
                        acc[brand] = store.items.filter(i => i.brand === brand).reduce((s, i) => s + i.quantity, 0);
                        return acc;
                      }, {} as Record<string, number>);
                      const total = Object.values(brandCounts).reduce((s, c) => s + c, 0);
                      
                      return (
                        <tr key={store.store_id} className="hover:bg-muted/50">
                          <td className="p-2 border-b font-medium">{store.store_name}</td>
                          {BRANDS.map(brand => (
                            <td key={brand} className="text-center p-2 border-b">
                              {brandCounts[brand] > 0 ? (
                                <span className="font-mono">{brandCounts[brand]}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          ))}
                          <td className="text-center p-2 border-b font-bold">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities">
          <Card>
            <CardHeader>
              <CardTitle>Piggyback Opportunities</CardTitle>
              <CardDescription>
                Stores already on routes that could receive additional brands
              </CardDescription>
            </CardHeader>
            <CardContent>
              {intelligence.piggybackOpportunities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>All opportunities optimized — no additional piggybacks available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {intelligence.piggybackOpportunities.map(opp => (
                    <div 
                      key={opp.store_id}
                      className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{opp.store_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Currently: {opp.currentBrands.join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-blue-500">
                            +{opp.potentialSavings} stops saved
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Add:</span>
                        {opp.missingBrands.map(brand => (
                          <Badge key={brand} variant="outline" className={getBrandColor(brand)}>
                            {brand}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dispatch">
          <DispatchIntakePanel onStoresSelected={handleDispatchSignalsSelected} />
        </TabsContent>

        <TabsContent value="ai-suggestions">
          <AISuggestionsPanel onApplySuggestion={handleAISuggestionApply} />
        </TabsContent>
      </Tabs>

      {/* Route Assignment Dialog — integrated with dispatch circuit */}
      <RouteAssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        assigneeId=""
        assigneeName=""
        assigneeType="driver"
        bulkMode={true}
        preselectedStores={assignmentContext.storeIds}
        brandStopContext={assignmentContext.brandStopContext}
        brandIds={assignmentContext.brands}
      />
    </div>
  );
}