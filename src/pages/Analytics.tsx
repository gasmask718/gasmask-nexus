import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Package, MapPin, Trophy } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface StoreStats {
  borough: string;
  count: number;
  active: number;
}

interface RevenueData {
  date: string;
  revenue: number;
  visits: number;
}

interface TopStore {
  id: string;
  name: string;
  revenue: number;
  visits: number;
}

const Analytics = () => {
  const [storesByBorough, setStoresByBorough] = useState<StoreStats[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [topStores, setTopStores] = useState<TopStore[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Fetch stores data
      const { data: stores } = await supabase
        .from('stores')
        .select('id, name, address_city, status, tags');

      if (stores) {
        // Group by borough
        const boroughMap: { [key: string]: { count: number; active: number } } = {};
        
        stores.forEach(store => {
          const borough = store.tags?.find((tag: string) => 
            ['brooklyn', 'queens', 'bronx', 'manhattan', 'staten-island'].includes(tag)
          ) || 'other';
          
          if (!boroughMap[borough]) {
            boroughMap[borough] = { count: 0, active: 0 };
          }
          
          boroughMap[borough].count++;
          if (store.status === 'active') {
            boroughMap[borough].active++;
          }
        });

        const stats = Object.entries(boroughMap).map(([borough, data]) => ({
          borough: borough.charAt(0).toUpperCase() + borough.slice(1).replace('-', ' '),
          count: data.count,
          active: data.active,
        }));

        setStoresByBorough(stats);

        // Fetch visit logs for revenue analysis
        const { data: visits } = await supabase
          .from('visit_logs')
          .select('visit_datetime, cash_collected, visit_type, store_id')
          .order('visit_datetime', { ascending: true });

        if (visits) {
          // Calculate total revenue and deliveries
          const revenue = visits.reduce((sum, v) => sum + (v.cash_collected || 0), 0);
          const deliveries = visits.filter(v => v.visit_type === 'delivery').length;
          
          setTotalRevenue(revenue);
          setTotalDeliveries(deliveries);

          // Group by date for revenue trend
          const dateMap: { [key: string]: { revenue: number; visits: number } } = {};
          
          visits.forEach(visit => {
            const date = new Date(visit.visit_datetime).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            });
            
            if (!dateMap[date]) {
              dateMap[date] = { revenue: 0, visits: 0 };
            }
            
            dateMap[date].revenue += visit.cash_collected || 0;
            dateMap[date].visits += 1;
          });

          const revenueChart = Object.entries(dateMap).map(([date, data]) => ({
            date,
            revenue: data.revenue,
            visits: data.visits,
          }));

          setRevenueData(revenueChart);

          // Calculate top stores by revenue
          const storeMap: { [key: string]: { revenue: number; visits: number } } = {};
          
          visits.forEach(visit => {
            if (!visit.store_id) return;
            
            if (!storeMap[visit.store_id]) {
              storeMap[visit.store_id] = { revenue: 0, visits: 0 };
            }
            
            storeMap[visit.store_id].revenue += visit.cash_collected || 0;
            storeMap[visit.store_id].visits += 1;
          });

          const topStoresData = Object.entries(storeMap)
            .map(([storeId, data]) => {
              const store = stores.find(s => s.id === storeId);
              return {
                id: storeId,
                name: store?.name || 'Unknown Store',
                revenue: data.revenue,
                visits: data.visits,
              };
            })
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

          setTopStores(topStoresData);
        }
      }
      setLoading(false);
    };

    fetchAnalytics();
  }, []);

  const metricCards = [
    {
      title: 'Total Revenue',
      value: `$${totalRevenue.toFixed(2)}`,
      change: 'All time',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Boxes Delivered',
      value: totalDeliveries.toString(),
      change: 'Total deliveries',
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Average per Visit',
      value: totalDeliveries > 0 ? `$${(totalRevenue / totalDeliveries).toFixed(2)}` : '$0',
      change: 'Per delivery',
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          Performance metrics and business intelligence
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        {metricCards.map((metric, index) => (
          <Card
            key={metric.title}
            className="glass-card border-border/50 hover-lift"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className={`${metric.bgColor} p-2 rounded-lg`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-3xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground">{metric.change}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Geographic Distribution */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Store Distribution by Borough
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              {storesByBorough.map((stat, index) => (
                <div
                  key={stat.borough}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="space-y-1">
                    <p className="font-semibold">{stat.borough}</p>
                    <p className="text-sm text-muted-foreground">
                      {stat.active} active of {stat.count} total
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{stat.count}</div>
                    <p className="text-xs text-muted-foreground">stores</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Trend Chart */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Revenue Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(0 0% 60%)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(0 0% 60%)"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(0 0% 5%)',
                      border: '1px solid hsl(0 0% 15%)',
                      borderRadius: '8px',
                      color: 'hsl(0 0% 98%)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(142, 76%, 36%)" 
                    strokeWidth={2}
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No revenue data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visits by Date Chart */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              Visits Per Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(0 0% 60%)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(0 0% 60%)"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(0 0% 5%)',
                      border: '1px solid hsl(0 0% 15%)',
                      borderRadius: '8px',
                      color: 'hsl(0 0% 98%)'
                    }}
                  />
                  <Bar 
                    dataKey="visits" 
                    fill="hsl(217, 91%, 60%)" 
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No visit data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Stores Leaderboard */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top Performing Stores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : topStores.length > 0 ? (
            <div className="space-y-3">
              {topStores.map((store, index) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                      index === 1 ? 'bg-gray-400/20 text-gray-400' :
                      index === 2 ? 'bg-amber-700/20 text-amber-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{store.name}</p>
                      <p className="text-sm text-muted-foreground">{store.visits} visits</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-500">
                      ${store.revenue.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">revenue</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No store data yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
