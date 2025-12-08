import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Target, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Mock forecast data
const weeklyForecast = [
  { day: 'Mon', predicted: 4200, actual: 4100 },
  { day: 'Tue', predicted: 4800, actual: 5200 },
  { day: 'Wed', predicted: 5100, actual: 4900 },
  { day: 'Thu', predicted: 4600, actual: null },
  { day: 'Fri', predicted: 5500, actual: null },
  { day: 'Sat', predicted: 3200, actual: null },
  { day: 'Sun', predicted: 2100, actual: null },
];

const monthlyProjection = [
  { week: 'Week 1', revenue: 28500, campaigns: 12 },
  { week: 'Week 2', revenue: 31200, campaigns: 15 },
  { week: 'Week 3', revenue: 29800, campaigns: 14 },
  { week: 'Week 4', revenue: 33500, campaigns: 18 },
];

const riskAlerts = [
  { store: 'Brooklyn Smoke Shop', risk: 'high', reason: 'No orders in 21 days', action: 'Call campaign scheduled' },
  { store: 'Queens Tobacco', risk: 'medium', reason: 'Declining order frequency', action: 'SMS sequence active' },
  { store: 'Bronx Corner Store', risk: 'medium', reason: 'Missed last 2 deliveries', action: 'Review needed' },
];

export default function RevenueForecastPanel() {
  const totalWeeklyPredicted = weeklyForecast.reduce((acc, d) => acc + d.predicted, 0);
  const totalActual = weeklyForecast.filter(d => d.actual).reduce((acc, d) => acc + (d.actual || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Forecast</p>
                <p className="text-3xl font-bold">$4,600</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-green-500">+8% vs yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Weekly Projection</p>
                <p className="text-3xl font-bold">${totalWeeklyPredicted.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">94% confidence</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Target</p>
                <p className="text-3xl font-bold">$123,000</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <span className="text-muted-foreground">67% achieved</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Revenue Forecast</CardTitle>
            <CardDescription>Predicted vs actual daily revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyForecast}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="predicted" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)" 
                    name="Predicted"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="hsl(142 76% 36%)" 
                    fill="hsl(142 76% 36% / 0.2)" 
                    name="Actual"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Projection</CardTitle>
            <CardDescription>Revenue by week with campaign count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyProjection}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Revenue"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Revenue Risk Alerts
          </CardTitle>
          <CardDescription>
            Stores at risk of churning that may impact projections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {riskAlerts.map((alert, index) => (
              <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                <Badge 
                  variant={alert.risk === 'high' ? 'destructive' : 'secondary'}
                  className={alert.risk === 'high' ? '' : 'bg-orange-500/10 text-orange-500'}
                >
                  {alert.risk}
                </Badge>
                <div className="flex-1">
                  <p className="font-medium">{alert.store}</p>
                  <p className="text-sm text-muted-foreground">{alert.reason}</p>
                </div>
                <Badge variant="outline">{alert.action}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
