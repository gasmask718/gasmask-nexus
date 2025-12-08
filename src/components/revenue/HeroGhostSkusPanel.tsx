import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Ghost, TrendingUp, TrendingDown, RefreshCw, Package } from "lucide-react";
import { useHeroGhostSkus, useRevenueEngineV2Actions } from "@/hooks/useRevenueEngineV2";

interface HeroGhostSkusPanelProps {
  businessId?: string;
  verticalId?: string;
}

export function HeroGhostSkusPanel({ businessId, verticalId }: HeroGhostSkusPanelProps) {
  const { data, isLoading } = useHeroGhostSkus(businessId, verticalId);
  const { computeProductMetrics, isLoading: actionsLoading } = useRevenueEngineV2Actions();

  const getTrendIcon = (trend: number | null) => {
    if (!trend) return null;
    if (trend > 10) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < -10) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5" />
          Product Revenue Intelligence
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => computeProductMetrics.mutate({ businessId, verticalId })}
          disabled={actionsLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${computeProductMetrics.isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="heroes">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="heroes" className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Hero SKUs
            </TabsTrigger>
            <TabsTrigger value="ghosts" className="flex items-center gap-2">
              <Ghost className="h-4 w-4 text-muted-foreground" />
              Slow Movers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="heroes" className="mt-4">
            {data?.heroes && data.heroes.length > 0 ? (
              <div className="space-y-2">
                {data.heroes.map((hero) => (
                  <div 
                    key={hero.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-yellow-500/5 border-yellow-500/20"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        Product #{hero.product_id.slice(0, 8)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{hero.units_sold_30d || 0} units/30d</span>
                        <span>•</span>
                        <span>{hero.unique_stores_30d || 0} stores</span>
                        {getTrendIcon(hero.trend_30d)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-yellow-600">
                        {Math.round(hero.hero_score || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Hero Score</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">
                No hero SKUs found. Run the engine to compute.
              </p>
            )}
          </TabsContent>

          <TabsContent value="ghosts" className="mt-4">
            {data?.ghosts && data.ghosts.length > 0 ? (
              <div className="space-y-2">
                {data.ghosts.map((ghost) => (
                  <div 
                    key={ghost.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        Product #{ghost.product_id.slice(0, 8)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{ghost.units_sold_90d || 0} units/90d</span>
                        <span>•</span>
                        <span>{ghost.unique_stores_90d || 0} stores</span>
                        {getTrendIcon(ghost.trend_30d)}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {(ghost.tags || []).map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-muted-foreground">
                        {Math.round(ghost.ghost_score || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Ghost Score</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">
                No slow-moving SKUs found.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
