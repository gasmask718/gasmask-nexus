/**
 * Floor9Predictions - AI Forward Intelligence + Store Health Scores + Product Radar
 * 
 * Fully data-driven from store_health_scores, checklist_tube_intelligence, and store_master.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, Activity,
  Target, RefreshCw, Loader2, Package, Store, Heart,
  ArrowUp, ArrowDown, Minus, Route as RouteIcon
} from "lucide-react";
import { ShadowModeBanner } from "@/components/floor9";
import { StoreHealthBadge } from "@/components/floor9/StoreHealthBadge";
import { useStoreHealthScores, useCalculateHealthScores, useProductIntelligence } from "@/hooks/useStoreHealthScores";
import { RouteAssignmentDialog } from "@/components/delivery/RouteAssignmentDialog";
import { cn } from "@/lib/utils";

export default function Floor9Predictions() {
  const [activeTab, setActiveTab] = useState('health');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dispatchStores, setDispatchStores] = useState<string[]>([]);
  const { data: healthScores, isLoading: healthLoading } = useStoreHealthScores({ limit: 50 });
  const { data: productIntel, isLoading: productLoading } = useProductIntelligence();
  const calculateHealth = useCalculateHealthScores();

  const flaggedStoreIds = useMemo(
    () => (healthScores || []).filter(s => s.health_status === 'Critical' || s.health_status === 'At Risk').map(s => s.store_id),
    [healthScores]
  );
  const toggleOne = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const criticalStores = healthScores?.filter(s => s.health_status === 'Critical') || [];
  const atRiskStores = healthScores?.filter(s => s.health_status === 'At Risk') || [];
  const healthyStores = healthScores?.filter(s => s.health_status === 'Healthy') || [];
  const needsAttention = healthScores?.filter(s => s.health_status === 'Needs Attention') || [];

  const avgScore = healthScores?.length
    ? Math.round(healthScores.reduce((sum, s) => sum + s.overall_score, 0) / healthScores.length)
    : 0;

  return (
    <div className="space-y-6">
      <ShadowModeBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Predictions & Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Store health scores, product intelligence, and forward-looking insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={selectedIds.length === 0}
            onClick={() => setDispatchStores(selectedIds)}
            className="gap-2"
          >
            <RouteIcon className="h-4 w-4" /> Dispatch Selected ({selectedIds.length})
          </Button>
          <Button
            variant="outline"
            disabled={flaggedStoreIds.length === 0}
            onClick={() => setDispatchStores(flaggedStoreIds)}
            className="gap-2"
          >
            <AlertTriangle className="h-4 w-4" /> Dispatch All Flagged ({flaggedStoreIds.length})
          </Button>
          <Button
            onClick={() => calculateHealth.mutate(undefined)}
            disabled={calculateHealth.isPending}
            className="gap-2"
          >
            {calculateHealth.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Calculate Health Scores
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Avg Health Score"
          value={avgScore}
          icon={<Heart className="h-4 w-4" />}
          color={avgScore >= 60 ? 'text-green-500' : 'text-amber-500'}
          isLoading={healthLoading}
        />
        <SummaryCard
          title="Critical Stores"
          value={criticalStores.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          color="text-red-500"
          isLoading={healthLoading}
        />
        <SummaryCard
          title="At Risk"
          value={atRiskStores.length}
          icon={<TrendingDown className="h-4 w-4" />}
          color="text-orange-500"
          isLoading={healthLoading}
        />
        <SummaryCard
          title="Healthy"
          value={healthyStores.length}
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-green-500"
          isLoading={healthLoading}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="health" className="gap-1.5">
            <Heart className="h-3.5 w-3.5" /> Store Health
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Product Intel
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Opportunities
          </TabsTrigger>
        </TabsList>

        {/* Store Health Tab */}
        <TabsContent value="health" className="space-y-4">
          {healthLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !healthScores?.length ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No health scores calculated yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Click "Calculate Health Scores" to analyze all stores.</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {healthScores.map((store) => (
                  <Card key={store.store_id} className={cn("transition-colors",
                    store.health_status === 'Critical' && "border-red-500/30",
                    store.health_status === 'At Risk' && "border-orange-500/30",
                  )}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox
                            checked={selectedIds.includes(store.store_id)}
                            onCheckedChange={() => toggleOne(store.store_id)}
                            aria-label={`Select ${store.store_name}`}
                          />
                          <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{store.store_name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StoreHealthBadge score={store.overall_score} status={store.health_status} size="md" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDispatchStores([store.store_id])}
                            title="Add to route"
                          >
                            <RouteIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Progress value={store.overall_score} className="h-1.5 mb-2" />
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {Object.entries(store.dimension_scores || {}).map(([key, value]) => (
                          <div key={key} className="text-center">
                            <div className="text-[10px] text-muted-foreground capitalize">{key}</div>
                            <div className={cn("text-xs font-semibold",
                              (value as number) >= 70 ? "text-green-500" : (value as number) >= 40 ? "text-amber-500" : "text-red-500"
                            )}>{value as number}</div>
                          </div>
                        ))}
                      </div>
                      {store.last_visit_date && (
                        <p className="text-[10px] text-muted-foreground mt-1">Last visit: {store.last_visit_date} · {store.total_visits_30d} visits in 30d</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Product Intel Tab */}
        <TabsContent value="products" className="space-y-4">
          {productLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : !productIntel?.length ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No product intelligence data available yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {productIntel.map((product) => {
                const interestRate = product.totalSignals > 0
                  ? Math.round((product.interestedCount / product.totalSignals) * 100)
                  : 0;

                return (
                  <Card key={product.name}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{product.name}</span>
                        {product.zeroStockStores > 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            {product.zeroStockStores} zero-stock
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-lg font-bold">{product.totalTubes}</div>
                          <div className="text-[10px] text-muted-foreground">Total Tubes</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{product.storeCount}</div>
                          <div className="text-[10px] text-muted-foreground">Stores</div>
                        </div>
                        <div>
                          <div className={cn("text-lg font-bold", interestRate >= 50 ? "text-green-500" : "text-muted-foreground")}>
                            {interestRate}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">Interest Rate</div>
                        </div>
                      </div>
                      {product.totalSignals > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                            <span>{product.interestedCount} interested</span>
                            <span>{product.notInterestedCount} not interested</span>
                          </div>
                          <Progress value={interestRate} className="h-1" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Growth Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Stores with high interest signals but no recent follow-up tasks
                </p>
                <div className="text-2xl font-bold text-green-500">
                  {productIntel?.reduce((sum, p) => sum + p.interestedCount, 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">total interest signals across all products</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Churn Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Stores with declining health scores or no visits in 45+ days
                </p>
                <div className="text-2xl font-bold text-red-500">
                  {criticalStores.length}
                </div>
                <p className="text-xs text-muted-foreground">stores at critical health level</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-500" />
                  Reorder Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Products with active status but zero tube count
                </p>
                <div className="text-2xl font-bold text-amber-500">
                  {productIntel?.reduce((sum, p) => sum + p.zeroStockStores, 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">zero-stock product instances needing reorder</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Top Products by Interest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {productIntel?.filter(p => p.interestedCount > 0)
                    .sort((a, b) => b.interestedCount - a.interestedCount)
                    .slice(0, 5)
                    .map(p => (
                      <div key={p.name} className="flex items-center justify-between text-sm">
                        <span>{p.name}</span>
                        <Badge variant="outline" className="text-[10px]">{p.interestedCount} interested</Badge>
                      </div>
                    ))}
                  {(!productIntel?.some(p => p.interestedCount > 0)) && (
                    <p className="text-sm text-muted-foreground">No interest signals recorded yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ title, value, icon, color, isLoading }: {
  title: string; value: number; icon: React.ReactNode; color: string; isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          {isLoading ? <Skeleton className="h-7 w-12 mt-1" /> : (
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
          )}
        </div>
        <div className={cn("p-2 rounded-full bg-muted", color)}>{icon}</div>
      </CardContent>
    </Card>
  );
}
