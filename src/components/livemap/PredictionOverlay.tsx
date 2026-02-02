// ═══════════════════════════════════════════════════════════════════════════════
// PREDICTION OVERLAY — Phase 4 Predictive Intelligence Display
// Risk heat overlay, ETA bubbles, capacity warnings, recommendations
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  Clock,
  Gauge,
  TrendingUp,
  Users,
  Route,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Target,
  Zap,
} from "lucide-react";
import type { 
  RoutePrediction, 
  CapacitySummary, 
  PredictionsSummary,
  RouteRecommendation,
} from "@/hooks/useRouteIntelligence";

interface PredictionOverlayProps {
  visible: boolean;
  predictions: RoutePrediction[];
  capacitySummary: CapacitySummary[];
  summary: PredictionsSummary;
  onSelectRoute: (routeId: string) => void;
}

export function PredictionOverlay({
  visible,
  predictions,
  capacitySummary,
  summary,
  onSelectRoute,
}: PredictionOverlayProps) {
  const [activeTab, setActiveTab] = useState('risks');
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  if (!visible) return null;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-green-500 text-white';
    }
  };

  const getRiskBorderColor = (level: string) => {
    switch (level) {
      case 'critical': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-yellow-500';
      default: return 'border-l-green-500';
    }
  };

  const getCapacityColor = (status: string) => {
    switch (status) {
      case 'overloaded': return 'text-red-500';
      case 'underutilized': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const toggleRouteExpand = (routeId: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  };

  const highRiskPredictions = predictions.filter(p => 
    p.riskLevel === 'critical' || p.riskLevel === 'high'
  );

  const allRecommendations = predictions.flatMap(p => 
    p.recommendations.map(r => ({ ...r, routeId: p.routeId, assignee: p.assigneeName }))
  ).sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="absolute top-24 right-4 w-80 z-10">
      <Card className="bg-background/95 backdrop-blur border-border/50 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              Predictive Intelligence
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Live
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 px-4 pb-3">
            <div className="text-center p-2 rounded bg-muted/50">
              <div className="text-lg font-bold">{summary.totalRoutesMonitored}</div>
              <div className="text-[10px] text-muted-foreground">Monitored</div>
            </div>
            <div className="text-center p-2 rounded bg-orange-500/10">
              <div className="text-lg font-bold text-orange-500">{summary.routesAtRisk}</div>
              <div className="text-[10px] text-muted-foreground">At Risk</div>
            </div>
            <div className="text-center p-2 rounded bg-red-500/10">
              <div className="text-lg font-bold text-red-500">{summary.stopsLikelyLate}</div>
              <div className="text-[10px] text-muted-foreground">Late Stops</div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start px-4 bg-transparent">
              <TabsTrigger value="risks" className="text-xs flex-1">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Risks
              </TabsTrigger>
              <TabsTrigger value="capacity" className="text-xs flex-1">
                <Users className="h-3 w-3 mr-1" />
                Capacity
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs flex-1">
                <Lightbulb className="h-3 w-3 mr-1" />
                Actions
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[320px]">
              {/* Risks Tab */}
              <TabsContent value="risks" className="m-0 p-3 space-y-2">
                {highRiskPredictions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">All routes on track</p>
                  </div>
                ) : (
                  highRiskPredictions.map(pred => (
                    <Collapsible 
                      key={pred.routeId}
                      open={expandedRoutes.has(pred.routeId)}
                      onOpenChange={() => toggleRouteExpand(pred.routeId)}
                    >
                      <div 
                        className={`p-3 rounded-lg border border-l-4 cursor-pointer transition-all hover:bg-muted/50 ${getRiskBorderColor(pred.riskLevel)}`}
                        onClick={() => onSelectRoute(pred.routeId)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm truncate max-w-[140px]">
                            {pred.assigneeName}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getRiskColor(pred.riskLevel)} text-xs`}>
                              {pred.riskScore}
                            </Badge>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={e => e.stopPropagation()}>
                                {expandedRoutes.has(pred.routeId) ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {pred.estimatedRemainingMinutes}m left
                          </span>
                          <span>•</span>
                          <span>{pred.stopsAtRisk + pred.stopsLikelyLate} stops at risk</span>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="px-3 py-2 space-y-1 bg-muted/30 rounded-b-lg">
                          {pred.stopPredictions
                            .filter(s => s.status !== 'on_track')
                            .slice(0, 3)
                            .map(stop => (
                              <div key={stop.stopId} className="flex items-center justify-between text-xs py-1">
                                <span className="truncate max-w-[120px]">{stop.storeName}</span>
                                <Badge 
                                  variant="outline" 
                                  className={stop.status === 'likely_late' ? 'text-red-500' : 'text-yellow-500'}
                                >
                                  {stop.slaDeltaMinutes > 0 ? `T-${stop.slaDeltaMinutes}m` : `+${Math.abs(stop.slaDeltaMinutes)}m`}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
                )}
              </TabsContent>

              {/* Capacity Tab */}
              <TabsContent value="capacity" className="m-0 p-3 space-y-3">
                {capacitySummary.map(cap => (
                  <div key={cap.territory} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{cap.territory}</span>
                      <Badge 
                        variant="outline" 
                        className={getCapacityColor(cap.capacityStatus)}
                      >
                        {cap.capacityStatus}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Utilization</span>
                        <span className={getCapacityColor(cap.capacityStatus)}>
                          {cap.utilizationPercent}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, cap.utilizationPercent)} 
                        className="h-1.5"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-center">
                      <div>
                        <div className="font-semibold">{cap.totalRoutes}</div>
                        <div className="text-muted-foreground">Routes</div>
                      </div>
                      <div>
                        <div className="font-semibold">{cap.activeWorkers}</div>
                        <div className="text-muted-foreground">Workers</div>
                      </div>
                      <div>
                        <div className="font-semibold">{cap.avgStopsPerWorker}</div>
                        <div className="text-muted-foreground">Stops/Worker</div>
                      </div>
                    </div>

                    {cap.recommendations.length > 0 && (
                      <div className="mt-3 pt-2 border-t">
                        {cap.recommendations.map((rec, i) => (
                          <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                            <Zap className="h-3 w-3 text-primary" />
                            {rec}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              {/* Actions Tab */}
              <TabsContent value="actions" className="m-0 p-3 space-y-2">
                {allRecommendations.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recommendations</p>
                  </div>
                ) : (
                  allRecommendations.slice(0, 8).map((rec, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 ${
                        rec.priority === 'high' ? 'border-l-4 border-l-red-500' :
                        rec.priority === 'medium' ? 'border-l-4 border-l-yellow-500' :
                        'border-l-4 border-l-blue-500'
                      }`}
                      onClick={() => onSelectRoute(rec.routeId)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{rec.title}</span>
                        <Badge 
                          variant="outline"
                          className={
                            rec.priority === 'high' ? 'text-red-500' :
                            rec.priority === 'medium' ? 'text-yellow-500' :
                            'text-blue-500'
                          }
                        >
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.description}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        → {rec.assignee}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
