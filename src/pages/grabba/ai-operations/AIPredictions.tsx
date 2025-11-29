import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  MapPin,
  BarChart3,
  Target,
} from 'lucide-react';
import { useAIPredictions, useStoreQualityScores } from '@/hooks/useAIEngine';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';

const AIPredictions = () => {
  const { data: predictions, isLoading: predictionsLoading } = useAIPredictions();
  const { data: storeScores, isLoading: scoresLoading } = useStoreQualityScores();

  const getTrendIcon = (trend: 'rising' | 'stable' | 'declining') => {
    switch (trend) {
      case 'rising': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const brandColors: Record<string, string> = {
    grabba: 'bg-green-500',
    gasmask: 'bg-red-500',
    hotmama: 'bg-pink-500',
    scalati: 'bg-purple-500',
  };

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            AI Predictions & Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Machine learning powered forecasts and analysis
          </p>
        </div>

        <Tabs defaultValue="sales">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales">Sales Forecast</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="demand">Demand Analysis</TabsTrigger>
            <TabsTrigger value="stores">Store Scores</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {predictionsLoading ? (
                [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)
              ) : (
                predictions?.salesForecasts.map((forecast) => (
                  <Card key={forecast.brand}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="capitalize flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${brandColors[forecast.brand]}`} />
                          {forecast.brand}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(forecast.trend)}
                          <Badge variant={
                            forecast.trend === 'rising' ? 'default' :
                            forecast.trend === 'declining' ? 'destructive' : 'secondary'
                          }>
                            {forecast.trend}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">This Week</p>
                          <p className="text-2xl font-bold">${forecast.currentWeek.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Next Week (Predicted)</p>
                          <p className="text-2xl font-bold text-primary">${forecast.nextWeek.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Confidence</span>
                          <span>{forecast.confidence}%</span>
                        </div>
                        <Progress value={forecast.confidence} />
                      </div>
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm">
                          {forecast.trend === 'rising' 
                            ? `📈 Strong growth expected. Consider increasing production by ${Math.round((forecast.nextWeek - forecast.currentWeek) / forecast.currentWeek * 100)}%`
                            : forecast.trend === 'declining'
                            ? `📉 Sales may decline. Review marketing and distribution strategy.`
                            : `➡️ Stable performance expected. Maintain current operations.`
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {predictionsLoading ? (
                [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40" />)
              ) : (
                predictions?.inventoryProjections.map((item) => (
                  <Card key={item.brand} className={
                    item.urgency === 'critical' ? 'border-red-500' :
                    item.urgency === 'warning' ? 'border-yellow-500' : ''
                  }>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Package className={`h-5 w-5 ${
                          item.urgency === 'critical' ? 'text-red-500' :
                          item.urgency === 'warning' ? 'text-yellow-500' : 'text-muted-foreground'
                        }`} />
                        <span className="font-medium capitalize">{item.brand}</span>
                      </div>
                      <p className="text-4xl font-bold">{item.daysUntilDepletion}</p>
                      <p className="text-sm text-muted-foreground">days until depletion</p>
                      <Badge className="mt-4" variant={
                        item.urgency === 'critical' ? 'destructive' :
                        item.urgency === 'warning' ? 'secondary' : 'outline'
                      }>
                        {item.urgency === 'critical' ? '🚨 Order Now' :
                         item.urgency === 'warning' ? '⚠️ Plan Restock' : '✅ Healthy'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Inventory Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {predictions?.inventoryProjections
                    .filter(i => i.urgency !== 'ok')
                    .map((item) => (
                      <div key={item.brand} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${brandColors[item.brand]}`} />
                          <div>
                            <p className="font-medium capitalize">{item.brand}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.urgency === 'critical' 
                                ? 'Immediate restocking required'
                                : 'Schedule restock within this week'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={item.urgency === 'critical' ? 'destructive' : 'secondary'}>
                          {item.daysUntilDepletion} days left
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="demand" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Regional Demand Spikes
                  </CardTitle>
                  <CardDescription>Predicted high-demand areas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {predictions?.demandSpikes.map((spike, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500/10 to-transparent rounded-lg border border-green-500/20">
                        <div>
                          <p className="font-medium">{spike.region}</p>
                          <p className="text-sm text-muted-foreground">{spike.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-500">+{spike.expectedIncrease}%</p>
                          <p className="text-xs text-muted-foreground">expected increase</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    High-Performing Zones
                  </CardTitle>
                  <CardDescription>Top zip codes by performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['10451 - Bronx', '11206 - Brooklyn', '10027 - Harlem', '11385 - Queens', '10301 - Staten Island'].map((zone, idx) => (
                      <div key={zone} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                          {idx + 1}
                        </span>
                        <span className="flex-1">{zone}</span>
                        <Progress value={100 - idx * 15} className="w-24 h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="stores" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Store Quality Scores</CardTitle>
                <CardDescription>AI-calculated store performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {scoresLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {storeScores?.slice(0, 10).map((store) => (
                      <div key={store.storeId} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium">{store.storeName}</p>
                            <p className="text-sm text-muted-foreground">{store.recommendation}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${
                              store.overallScore >= 80 ? 'text-green-500' :
                              store.overallScore >= 60 ? 'text-yellow-500' :
                              store.overallScore >= 40 ? 'text-orange-500' : 'text-red-500'
                            }`}>
                              {store.overallScore}
                            </p>
                            <p className="text-xs text-muted-foreground">Quality Score</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-xs text-muted-foreground">Orders</p>
                            <p className="font-medium">{Math.round(store.factors.orderFrequency)}%</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-xs text-muted-foreground">Payment</p>
                            <p className="font-medium">{Math.round(store.factors.paymentReliability)}%</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-xs text-muted-foreground">Volume</p>
                            <p className="font-medium">{Math.round(store.factors.orderVolume)}%</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-xs text-muted-foreground">Comms</p>
                            <p className="font-medium">{Math.round(store.factors.communicationResponsiveness)}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </GrabbaLayout>
  );
};

export default AIPredictions;
