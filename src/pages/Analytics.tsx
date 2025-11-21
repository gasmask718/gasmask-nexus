import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Package, MapPin } from 'lucide-react';

interface StoreStats {
  borough: string;
  count: number;
  active: number;
}

const Analytics = () => {
  const [storesByBorough, setStoresByBorough] = useState<StoreStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const { data: stores } = await supabase
        .from('stores')
        .select('address_city, status, tags');

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
      }
      setLoading(false);
    };

    fetchAnalytics();
  }, []);

  const metricCards = [
    {
      title: 'Total Revenue',
      value: '$0',
      change: '+0%',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Boxes Delivered',
      value: '0',
      change: 'This week',
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Growth Rate',
      value: '0%',
      change: 'Month over month',
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

      {/* Placeholder for charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Chart coming soon...</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle>Top Performing Stores</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Leaderboard coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
